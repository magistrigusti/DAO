import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// GAS POOL — пул газа (оптимизированный)
// =====================================================
// Принимает: DOM (комиссия + налог) от Wallet
// Делает: 2 сообщения из СВОЕГО TON
//   1) Получателю — основная сумма
//   2) DOM Treasury — налог
// Накапливает: комиссию в domBalance
// Пополняется: TON через Bank Dominum
// =====================================================

global adminAddress: slice;           // Bank Dominum (пополняет TON)
global domTreasuryAddress: slice;     // куда налог (единый)
global masterAddress: slice;          // DOM Master
global jettonWalletCode: cell;        // код Jetton Wallet

global domBalance: int;               // накопленный DOM (комиссия пула)
global tonReserve: int;               // минимальный резерв TON

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();
    
    adminAddress = ds.loadMsgAddress();
    domTreasuryAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
    jettonWalletCode = ds.loadRef();
    
    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(masterAddress)
            .storeRef(jettonWalletCode)
            .storeCoins(domBalance)
            .storeCoins(tonReserve)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------

fun buildWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(masterAddress)
        .storeSlice(myAddress())
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
    var walletData = buildWalletData(owner);
    
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// -----------------------------------------------------
// SEND INTERNAL TRANSFER (Jetton)
// -----------------------------------------------------

fun sendInternalTransfer(
    toOwner: slice,
    jettonAmount: int,
    fromOwner: slice,
    responseDestination: slice,
    queryId: int,
    msgValue: int
) {
    if (jettonAmount <= 0) {
        return;
    }
    
    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(stateInit);
    
    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(fromOwner)
        .storeSlice(responseDestination)
        .storeCoins(0)
        .storeBool(false)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toWallet)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();
    
    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// SEND TON (простой перевод)
// -----------------------------------------------------

fun sendTon(to: slice, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }
    
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(to)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    
    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------

fun onInternalMessage(
    myBalance: int,
    msgValue: int,
    msgFull: cell,
    msgBody: slice
) {
    // Пустое сообщение — пополнение TON
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
    // OP_GAS_POOL_EXECUTE — выполнить transfer
    // Приходит от Jetton Wallet пользователя
    // Делаем 2 сообщения из СВОЕГО TON
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        // Читаем данные
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var fromOwner = msgBody.loadMsgAddress();
        var treasuryFee = msgBody.loadCoins();
        var gasPoolFee = msgBody.loadCoins();
        
        // Проверяем что отправитель — валидный Jetton Wallet
        var expectedWallet = buildWalletAddress(
            buildWalletStateInit(fromOwner)
        );
        
        assert(
            senderAddress.equalSlices(expectedWallet),
            ERROR_NOT_VALID_WALLET
        );
        
        // Сколько TON нужно на 2 сообщения
        var tonForTransfers = MIN_TON_FOR_STORAGE * 2;
        
        // Проверяем что хватает TON в пуле
        var availableTon = myBalance - tonReserve;
        assert(availableTon >= tonForTransfers, ERROR_INSUFFICIENT_GAS);
        
        // Накапливаем комиссию пула
        domBalance += gasPoolFee;
        saveData();
        
        // =====================================================
        // 2 СООБЩЕНИЯ (из нашего TON баланса)
        // =====================================================
        
        // 1) Получателю — основная сумма
        sendInternalTransfer(
            toOwner,
            jettonAmount,
            fromOwner,
            fromOwner,
            queryId,
            MIN_TON_FOR_STORAGE
        );
        
        // 2) DOM Treasury — единый налог
        sendInternalTransfer(
            domTreasuryAddress,
            treasuryFee,
            fromOwner,
            fromOwner,
            queryId + 1,
            MIN_TON_FOR_STORAGE
        );
        
        // Возврат TON пользователю — НЕ ДЕЛАЕМ
        // ~0.01 TON это "входной билет"
        
        return;
    }
    
    // =====================================================
    // OP_TOP_UP — пополнение TON (только admin)
    // =====================================================
    if (op == OP_TOP_UP) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        // TON уже на балансе
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW_DOM — вывести накопленный DOM (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_DOM) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var amount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        
        assert(amount <= domBalance, ERROR_INSUFFICIENT_BALANCE);
        
        domBalance -= amount;
        saveData();
        
        sendInternalTransfer(
            toOwner,
            amount,
            myAddress(),
            adminAddress,
            queryId,
            MIN_TON_FOR_STORAGE
        );
        
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW_TON — вывести TON (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_TON) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var amount = msgBody.loadCoins();
        var to = msgBody.loadMsgAddress();
        
        var availableTon = myBalance - tonReserve - msgValue;
        assert(amount <= availableTon, ERROR_INSUFFICIENT_BALANCE);
        
        sendTon(to, amount, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_SET_RESERVE — установить минимальный резерв
    // =====================================================
    if (op == OP_SET_RESERVE) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        tonReserve = msgBody.loadCoins();
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getPoolData(): (slice, slice, int, int, int) {
    loadData();
    
    var availableTon = getContractBalance() - tonReserve;
    
    return (
        adminAddress,
        domTreasuryAddress,
        domBalance,
        tonReserve,
        availableTon
    );
}