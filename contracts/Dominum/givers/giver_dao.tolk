// =====================================================
// GIVER DAO — Распределение DOM для системы DAO
// =====================================================
// Whitelist:
// • Bank DAO
// • DAO Foundation
// Управляется: СИД-фраза (owner)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;
global managerAddress: slice;
global walletAddress: slice;
global bankDaoAddress: slice;         // Whitelist #1
global daoFoundationAddress: slice;   // Whitelist #2

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    managerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
    bankDaoAddress = ds.loadMsgAddress();
    daoFoundationAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(managerAddress)
            .storeSlice(walletAddress)
            .storeSlice(bankDaoAddress)
            .storeSlice(daoFoundationAddress)
            .endCell()
    );
}

// =====================================================
// ПРОВЕРКА WHITELIST
// =====================================================

fun isAllowed(address: slice): int {
    if (address.equalSlices(bankDaoAddress)) {
        return true;
    }
    if (address.equalSlices(daoFoundationAddress)) {
        return true;
    }
    return false;
}

// =====================================================
// ОТПРАВКА ЖЕТОНОВ
// =====================================================

fun sendJettons(toAddress: slice, amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(walletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();
    
    sendRawMessage(msg, 1);
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
    
    // Отправить жетоны
    if (op == OP_SEND_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        assert(isAllowed(toAddress), ERROR_NOT_IN_WHITELIST);
        
        sendJettons(toAddress, amount, queryId);
        
        return;
    }
    
    // Получение жетонов
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }
    
    // Смена owner
    if (op == OP_CHANGE_GIVER_ADMIN) {
        assert(
            senderAddress.equalSlices(managerAddress),
            ERROR_NOT_MANAGER
        );
        
        var newOwner = msgBody.loadMsgAddress();
        ownerAddress = newOwner;
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getGiverData(): (slice, slice, slice, slice, slice) {
    loadData();
    return (
        ownerAddress,
        managerAddress,
        walletAddress,
        bankDaoAddress,
        daoFoundationAddress
    );
}