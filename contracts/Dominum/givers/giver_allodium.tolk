// =====================================================
// GIVER ALLODIUM — Распределение DOM для экосистемы Allodium
// =====================================================
// Whitelist:
// • FRS Allodium
// • Allodium Foundation
// Управляется: СИД-фраза (owner)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;              // СИД-фраза
global managerAddress: slice;            // Manager (меняет owner)
global walletAddress: slice;             // Jetton Wallet
global frsAllodiumAddress: slice;        // Whitelist #1
global allodiumFoundationAddress: slice; // Whitelist #2

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    managerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
    frsAllodiumAddress = ds.loadMsgAddress();
    allodiumFoundationAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(managerAddress)
            .storeSlice(walletAddress)
            .storeSlice(frsAllodiumAddress)
            .storeSlice(allodiumFoundationAddress)
            .endCell()
    );
}

// =====================================================
// ПРОВЕРКА WHITELIST
// =====================================================

fun isAllowed(address: slice): int {
    if (address.equalSlices(frsAllodiumAddress)) {
        return true;
    }
    if (address.equalSlices(allodiumFoundationAddress)) {
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
    
    // Отправить жетоны (только owner)
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
    
    // Получение жетонов (от Master)
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }
    
    // Смена owner (только Manager)
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
        frsAllodiumAddress,
        allodiumFoundationAddress
    );
}