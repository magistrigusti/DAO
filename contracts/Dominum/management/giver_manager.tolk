// =====================================================
// GIVER MANAGER — Управление whitelist гиверов
// =====================================================
// Управляется: СИД-фраза (НЕЗАВИСИМЫЙ)
// Функция: ТОЛЬКО менять whitelist на гиверах
// НЕ зависит от Master!
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;  // СИД-фраза владельца

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .endCell()
    );
}

// =====================================================
// ОТПРАВКА КОМАНДЫ НА ГИВЕР — СМЕНА WHITELIST
// =====================================================

fun sendChangeWhitelist(
    giverAddress: slice,
    newAddress1: slice,
    newAddress2: slice,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_CHANGE_WHITELIST, 32)
        .storeUint(queryId, 64)
        .storeSlice(newAddress1)
        .storeSlice(newAddress2)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(giverAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
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
    
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // =====================================================
    // OP_CHANGE_WHITELIST — сменить whitelist на гивере
    // Может ТОЛЬКО owner (СИД-фраза)!
    // =====================================================
    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var giverAddress = msgBody.loadMsgAddress();
        var newAddress1 = msgBody.loadMsgAddress();
        var newAddress2 = msgBody.loadMsgAddress();
        
        sendChangeWhitelist(
            giverAddress,
            newAddress1,
            newAddress2,
            queryId
        );
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getManagerData(): slice {
    loadData();
    return ownerAddress;
}