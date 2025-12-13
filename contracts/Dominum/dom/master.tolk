// =====================================================
// JETTON MASTER — Главный контракт токена DOM
// =====================================================
// Стандарт: TEP-74 (Jetton)
// 
// Роли:
// - adminAddress (СИД #3) — управляет Master
// - minterAddress — вызывает mint
// - managerAddress — можно заменить
//
// Функции:
// - Создаёт токены (mint) → на гиверы
// - Владеет Manager (может заменить)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global totalSupply: int;            // сколько токенов создано
global adminAddress: slice;         // СИД #3 — управляет Master
global minterAddress: slice;        // Minter контракт
global managerAddress: slice;       // Manager контракт (можно заменить)

global domTreasuryAddress: slice;   // DOM Treasury (50% налога)
global daoTreasuryAddress: slice;   // DAO Treasury (50% налога)

global giver1Address: slice;        // Giver Allodium
global giver2Address: slice;        // Giver DAO DOM
global giver3Address: slice;        // Giver Ecosystem

global content: cell;               // metadata токена
global jettonWalletCode: cell;      // код Jetton Wallet

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    
    // Основные данные
    totalSupply = ds.loadCoins();
    adminAddress = ds.loadMsgAddress();
    minterAddress = ds.loadMsgAddress();
    managerAddress = ds.loadMsgAddress();
    
    // Казначейства
    domTreasuryAddress = ds.loadMsgAddress();
    daoTreasuryAddress = ds.loadMsgAddress();
    
    // Гиверы в отдельной cell
    var giversCell = ds.loadRef().beginParse();
    giver1Address = giversCell.loadMsgAddress();
    giver2Address = giversCell.loadMsgAddress();
    giver3Address = giversCell.loadMsgAddress();
    
    // Контент и код wallet
    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    var giversCell = beginCell()
        .storeSlice(giver1Address)
        .storeSlice(giver2Address)
        .storeSlice(giver3Address)
        .endCell();
    
    setContractData(
        beginCell()
            .storeCoins(totalSupply)
            .storeSlice(adminAddress)
            .storeSlice(minterAddress)
            .storeSlice(managerAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(daoTreasuryAddress)
            .storeRef(giversCell)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// =====================================================
// ВЫЧИСЛЕНИЕ АДРЕСА WALLET
// =====================================================

fun calculateWalletStateInit(ownerAddress: slice): cell {
    var walletData = beginCell()
        .storeCoins(0)
        .storeSlice(ownerAddress)
        .storeSlice(myAddress())
        .storeSlice(domTreasuryAddress)
        .storeSlice(daoTreasuryAddress)
        .endCell();
    
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun calculateWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// =====================================================
// МИНТ ТОКЕНОВ
// =====================================================

fun sendToWallet(
    toAddress: slice,
    amount: int,
    queryId: int,
    msgValue: int
) {
    var stateInit = calculateWalletStateInit(toAddress);
    var walletAddress = calculateWalletAddress(stateInit);
    
    var msgBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(myAddress())
        .storeSlice(toAddress)
        .storeCoins(0)
        .storeBool(false)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(walletAddress)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(msgBody)
        .endCell();
    
    sendRawMessage(msg, 1);
}

fun mintJettons(amount: int, queryId: int, msgValue: int) {
    // Проверяем лимит
    assert(
        totalSupply + amount <= MAX_SUPPLY,
        ERROR_LIMIT_EXCEEDED
    );
    
    // Увеличиваем total_supply
    totalSupply = totalSupply + amount;
    
    // Делим на 3 части
    var amountPerGiver = amount / GIVERS_COUNT;
    var remainder = amount % GIVERS_COUNT;
    var tonPerTransfer = msgValue / GIVERS_COUNT;
    
    // Giver_1: Allodium (+ остаток)
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
    if (msgBody.isEndOfSlice()) {
        return;
    }
    
    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);
    
    if (flags & 1) {
        return;
    }
    
    var senderAddress = cs.loadMsgAddress();
    
    loadData();
    
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // =====================================================
    // OP_MINT — минт от Minter
    // =====================================================
    if (op == OP_MINT) {
        assert(
            senderAddress.equalSlices(minterAddress),
            ERROR_NOT_MINTER
        );
        
        var amount = msgBody.loadCoins();
        
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        
        mintJettons(amount, queryId, msgValue);
        
        return;
    }
    
    // =====================================================
    // OP_BURN_NOTIFICATION — уведомление о сжигании
    // =====================================================
    if (op == OP_BURN_NOTIFICATION) {
        var burnAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        
        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromAddress)
        );
        
        assert(
            senderAddress.equalSlices(expectedWallet),
            ERROR_NOT_VALID_WALLET
        );
        
        totalSupply = totalSupply - burnAmount;
        saveData();
        
        var responseAddress = msgBody.loadMsgAddress();
        if (~ responseAddress.isAddressNone()) {
            var msg = beginCell()
                .storeUint(0x10, 6)
                .storeSlice(responseAddress)
                .storeCoins(0)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeUint(OP_EXCESSES, 32)
                .storeUint(queryId, 64)
                .endCell();
            
            sendRawMessage(msg, 64 + 2);
        }
        
        return;
    }
    
    // =====================================================
    // OP_REPLACE_MANAGER — заменить Manager
    // Только admin (СИД #3)!
    // =====================================================
    if (op == OP_REPLACE_MANAGER) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var newManager = msgBody.loadMsgAddress();
        managerAddress = newManager;
        saveData();
        
        return;
    }
    
    // =====================================================
    // OP_CHANGE_MASTER_ADMIN — сменить admin Master
    // Только текущий admin (СИД #3)!
    // =====================================================
    if (op == OP_CHANGE_MASTER_ADMIN) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var newAdmin = msgBody.loadMsgAddress();
        adminAddress = newAdmin;
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS (стандарт TEP-74)
// =====================================================

get fun getJettonData(): (int, int, slice, cell, cell) {
    loadData();
    
    return (
        totalSupply,
        -1,
        adminAddress,
        content,
        jettonWalletCode
    );
}

get fun getWalletAddress(ownerAddress: slice): slice {
    loadData();
    
    var stateInit = calculateWalletStateInit(ownerAddress);
    return calculateWalletAddress(stateInit);
}

get fun getMasterData(): (slice, slice, slice, slice, slice) {
    loadData();
    
    return (
        adminAddress,
        minterAddress,
        managerAddress,
        domTreasuryAddress,
        daoTreasuryAddress
    );
}

get fun getGiversData(): (slice, slice, slice) {
    loadData();
    
    return (
        giver1Address,
        giver2Address,
        giver3Address
    );
}