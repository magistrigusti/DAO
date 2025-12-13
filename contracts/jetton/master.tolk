// =====================================================
// JETTON MASTER — Главный контракт токена DOM
// =====================================================
// Стандарт: TEP-74 (Jetton)
// Роль:
// - Создаёт токены (увеличивает total_supply)
// - Создаёт Jetton Wallet
// - При минте transfer на 3 гивера через Wallet
// =====================================================

import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// =====================================================
// STORAGE
// =====================================================

global totalSupply: int;           // сколько токенов создано
global minterAddress: slice;       // кто может минтить (Minter)
global treasuryAddress: slice;     // казначейство (50% налога)
global foundationAddress: slice;   // фонд (50% налога)

global giver1Address: slice;       // Allodium
global giver2Address: slice;       // DAO DOM
global giver3Address: slice;       // Ecosystem

global content: cell;              // metadata токена
global jettonWalletCode: cell;     // код Jetton Wallet

// =====================================================
// LOAD / SAVE DATA
// =====================================================

// Загрузка данных из storage
fun loadData() {
    var ds = getContractData().beginParse();
    
    // Основные данные
    totalSupply = ds.loadCoins();
    minterAddress = ds.loadMsgAddress();
    treasuryAddress = ds.loadMsgAddress();
    foundationAddress = ds.loadMsgAddress();
    
    // Гиверы в отдельной cell (экономия газа)
    var giversCell = ds.loadRef().beginParse();
    giver1Address = giversCell.loadMsgAddress();
    giver2Address = giversCell.loadMsgAddress();
    giver3Address = giversCell.loadMsgAddress();
    
    // Контент и код wallet
    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

// Сохранение данных в storage
fun saveData() {
    // Гиверы в отдельную cell
    var giversCell = beginCell()
        .storeSlice(giver1Address)
        .storeSlice(giver2Address)
        .storeSlice(giver3Address)
        .endCell();
    
    // Собираем основную cell
    setContractData(
        beginCell()
            .storeCoins(totalSupply)
            .storeSlice(minterAddress)
            .storeSlice(treasuryAddress)
            .storeSlice(foundationAddress)
            .storeRef(giversCell)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// =====================================================
// ВЫЧИСЛЕНИЕ АДРЕСА WALLET
// =====================================================

// Формируем StateInit для Jetton Wallet
fun calculateWalletStateInit(ownerAddress: slice): cell {
    // Data для wallet: balance, owner, master, foundation, treasury
    var walletData = beginCell()
        .storeCoins(0)                      // начальный баланс = 0
        .storeSlice(ownerAddress)           // владелец wallet
        .storeSlice(myAddress())            // адрес master (мы)
        .storeSlice(foundationAddress)      // для налога
        .storeSlice(treasuryAddress)        // для налога
        .endCell();
    
    // StateInit = code + data
    return beginCell()
        .storeUint(0, 2)                    // split_depth, special
        .storeMaybeRef(jettonWalletCode)    // code
        .storeMaybeRef(walletData)          // data
        .storeUint(0, 1)                    // library
        .endCell();
}

// Вычисляем адрес wallet по StateInit
fun calculateWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)                    // addr_std$10 + anycast = 0
        .storeInt(0, 8)                     // workchain = 0
        .storeUint(stateInit.hash(), 256)   // hash of StateInit
        .endCell()
        .beginParse();
}

// =====================================================
// МИНТ ТОКЕНОВ
// =====================================================

// Отправка токенов на один wallet (internal transfer)
fun sendToWallet(
    toAddress: slice,
    amount: int,
    queryId: int,
    msgValue: int
) {
    // StateInit для wallet получателя
    var stateInit = calculateWalletStateInit(toAddress);
    var walletAddress = calculateWalletAddress(stateInit);
    
    // Тело сообщения: internal_transfer
    var msgBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)                  // сколько токенов
        .storeSlice(myAddress())             // from = master (мы)
        .storeSlice(toAddress)               // response_destination
        .storeCoins(0)                       // forward_ton_amount
        .storeBool(false)                    // forward_payload в slice
        .endCell();
    
    // Формируем сообщение с StateInit (деплой wallet если нет)
    var msg = beginCell()
        .storeUint(0x18, 6)                  // флаги: bounce
        .storeSlice(walletAddress)           // получатель
        .storeCoins(msgValue)                // TON для gas + налог
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)                 // StateInit
        .storeRef(msgBody)                   // body
        .endCell();
    
    sendRawMessage(msg, 1);  // pay fees separately
}

// Минт токенов и распределение на 3 гивера
fun mintTokens(amount: int, queryId: int, msgValue: int) {
    // Проверяем лимит
    assert(
        totalSupply + amount <= MAX_SUPPLY,
        ERROR_LIMIT_EXCEEDED
    );
    
    // Увеличиваем total_supply
    totalSupply = totalSupply + amount;
    
    // Делим на 3 равные части
    var amountPerGiver = amount / GIVERS_COUNT;
    var remainder = amount % GIVERS_COUNT;
    
    // TON на каждый transfer (gas + налог)
    var tonPerTransfer = msgValue / GIVERS_COUNT;
    
    // Giver_1: Allodium (+ остаток если не делится)
    sendToWallet(
        giver1Address,
        amountPerGiver + remainder,
        queryId,
        tonPerTransfer
    );
    
    // Giver_2: DAO DOM
    sendToWallet(
        giver2Address,
        amountPerGiver,
        queryId,
        tonPerTransfer
    );
    
    // Giver_3: Ecosystem
    sendToWallet(
        giver3Address,
        amountPerGiver,
        queryId,
        tonPerTransfer
    );
    
    // Сохраняем обновлённый total_supply
    saveData();
}

// =====================================================
// ОБРАБОТКА ВХОДЯЩИХ СООБЩЕНИЙ
// =====================================================

fun onInternalMessage(
    myBalance: int,
    msgValue: int,
    msgFull: cell,
    msgBody: slice
) {
    // Пустое сообщение — игнорируем
    if (msgBody.isEndOfSlice()) {
        return;
    }
    
    // Парсим отправителя
    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);
    
    // Bounced сообщения — игнорируем
    if (flags & 1) {
        return;
    }
    
    var senderAddress = cs.loadMsgAddress();
    
    // Загружаем данные
    loadData();
    
    // Читаем op-код и query_id
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // =====================================================
    // OP_MINT — минт от Minter
    // =====================================================
    if (op == OP_MINT) {
        // Проверяем что отправитель = Minter
        assert(
            senderAddress.equalSlices(minterAddress),
            ERROR_NOT_MINTER
        );
        
        // Читаем сколько минтить
        var amount = msgBody.loadCoins();
        
        // Проверяем что amount > 0
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        
        // Минтим и распределяем на гиверы
        mintTokens(amount, queryId, msgValue);
        
        return;
    }
    
    // =====================================================
    // OP_BURN_NOTIFICATION — уведомление о сжигании
    // =====================================================
    if (op == OP_BURN_NOTIFICATION) {
        // Читаем данные
        var burnAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        
        // Проверяем что sender = wallet этого from
        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromAddress)
        );
        
        assert(
            senderAddress.equalSlices(expectedWallet),
            ERROR_NOT_VALID_WALLET
        );
        
        // Уменьшаем total_supply
        totalSupply = totalSupply - burnAmount;
        
        // Сохраняем
        saveData();
        
        // Отправляем excesses обратно
        var responseAddress = msgBody.loadMsgAddress();
        if (~ responseAddress.isAddressNone()) {
            var msg = beginCell()
                .storeUint(0x10, 6)           // non-bounce
                .storeSlice(responseAddress)
                .storeCoins(0)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeUint(OP_EXCESSES, 32)
                .storeUint(queryId, 64)
                .endCell();
            
            sendRawMessage(msg, 64 + 2);  // carry gas, ignore errors
        }
        
        return;
    }
    
    // Неизвестный op-код — отбиваем
    throw(0xffff);
}

// =====================================================
// GETTERS (стандарт TEP-74)
// =====================================================

// Получить данные токена
get fun getJettonData(): (int, int, slice, cell, cell) {
    loadData();
    
    return (
        totalSupply,          // total_supply
        -1,                   // mintable = true
        minterAddress,        // admin_address (Minter)
        content,              // jetton_content
        jettonWalletCode      // jetton_wallet_code
    );
}

// Получить адрес wallet по владельцу
get fun getWalletAddress(ownerAddress: slice): slice {
    loadData();
    
    var stateInit = calculateWalletStateInit(ownerAddress);
    return calculateWalletAddress(stateInit);
}