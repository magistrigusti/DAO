// =====================================================
// TREASURY MANAGER — Казначей системы Dominum
// =====================================================
// Управляет: DOM Treasury, DAO Treasury, Gas Pool
// Управляется: Bank Dominum
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global bankDominumAddress: slice;   // Bank Dominum (главный)
global domTreasuryAddress: slice;   // DOM Treasury
global daoTreasuryAddress: slice;   // DAO Treasury
global gasPoolAddress: slice;       // Gas Pool

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    bankDominumAddress = ds.loadMsgAddress();
    domTreasuryAddress = ds.loadMsgAddress();
    daoTreasuryAddress = ds.loadMsgAddress();
    gasPoolAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(bankDominumAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(daoTreasuryAddress)
            .storeSlice(gasPoolAddress)
            .endCell()
    );
}

// =====================================================
// ОТПРАВКА КОМАНДЫ НА КОНТРАКТ
// =====================================================

fun sendCommand(
    targetAddress: slice,
    op: int,
    payload: cell,
    tonAmount: int,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(op, 32)
        .storeUint(queryId, 64)
        .storeRef(payload)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(targetAddress)
        .storeCoins(tonAmount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();
    
    sendRawMessage(msg, 64);
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
    
    // Проверяем что отправитель = Bank Dominum
    assert(
        senderAddress.equalSlices(bankDominumAddress),
        ERROR_NOT_OWNER
    );
    
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // =====================================================
    // OP_UPDATE_DOM_TREASURY — обновить адрес DOM Treasury
    // =====================================================
    if (op == OP_UPDATE_DOM_TREASURY) {
        var newAddress = msgBody.loadMsgAddress();
        domTreasuryAddress = newAddress;
        saveData();
        return;
    }
    
    // =====================================================
    // OP_UPDATE_DAO_TREASURY — обновить адрес DAO Treasury
    // =====================================================
    if (op == OP_UPDATE_DAO_TREASURY) {
        var newAddress = msgBody.loadMsgAddress();
        daoTreasuryAddress = newAddress;
        saveData();
        return;
    }
    
    // =====================================================
    // OP_UPDATE_GAS_POOL — обновить адрес Gas Pool
    // =====================================================
    if (op == OP_UPDATE_GAS_POOL) {
        var newAddress = msgBody.loadMsgAddress();
        gasPoolAddress = newAddress;
        saveData();
        return;
    }
    
    // =====================================================
    // OP_UPDATE_POOL_RATE — обновить курс в Gas Pool
    // =====================================================
    if (op == OP_UPDATE_POOL_RATE) {
        var newRate = msgBody.loadUint(32);
        
        var payload = beginCell()
            .storeUint(newRate, 32)
            .endCell();
        
        sendCommand(
            gasPoolAddress,
            OP_UPDATE_RATE,
            payload,
            MIN_TON_FOR_STORAGE,
            queryId
        );
        
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW_FROM_POOL — вывести DOM из Gas Pool
    // =====================================================
    if (op == OP_WITHDRAW_FROM_POOL) {
        var toAddress = msgBody.loadMsgAddress();
        var amount = msgBody.loadCoins();
        
        var payload = beginCell()
            .storeSlice(toAddress)
            .storeCoins(amount)
            .endCell();
        
        sendCommand(
            gasPoolAddress,
            OP_WITHDRAW_DOM,
            payload,
            MIN_TON_FOR_STORAGE,
            queryId
        );
        
        return;
    }
    
    // =====================================================
    // OP_REFILL_POOL — пополнить TON в Gas Pool
    // =====================================================
    if (op == OP_REFILL_POOL) {
        var tonAmount = msgBody.loadCoins();
        
        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(tonAmount)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .endCell();
        
        sendRawMessage(msg, 1);
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getTreasuryManagerData(): (slice, slice, slice, slice) {
    loadData();
    return (
        bankDominumAddress,
        domTreasuryAddress,
        daoTreasuryAddress,
        gasPoolAddress
    );
}