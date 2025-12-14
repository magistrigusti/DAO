// =====================================================
// DOM TREASURY — Казначейство токена Dominum
// =====================================================
// Принимает: налог (0.025 TON)
// Отправляет: ТОЛЬКО на Bank DOM или DOM Foundation
// Управляется: СИД-фраза (owner)
// Whitelist: ЗАХАРДКОЖЕН при деплое!
// =====================================================

import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;           // СИД-фраза
global walletAddress: slice;          // Jetton Wallet
global bankDomAddress: slice;         // Whitelist #1
global domFoundationAddress: slice;   // Whitelist #2

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
    bankDomAddress = ds.loadMsgAddress();
    domFoundationAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(walletAddress)
            .storeSlice(bankDomAddress)
            .storeSlice(domFoundationAddress)
            .endCell()
    );
}

// =====================================================
// ПРОВЕРКА WHITELIST
// =====================================================

fun isAllowed(address: slice): int {
    if (address.equalSlices(bankDomAddress)) {
        return true;
    }
    if (address.equalSlices(domFoundationAddress)) {
        return true;
    }
    return false;
}

// =====================================================
// ВЫВОД TON
// =====================================================

fun withdrawTon(toAddress: slice, amount: int) {
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();
    
    sendRawMessage(msg, 1);
}

// =====================================================
// ВЫВОД ЖЕТОНОВ
// =====================================================

fun withdrawJettons(toAddress: slice, amount: int, queryId: int) {
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
    
    // Приём налога
    if (op == OP_RECEIVE_TAX) {
        return;
    }
    
    // Вывод TON
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        assert(isAllowed(toAddress), ERROR_NOT_IN_WHITELIST);
        
        withdrawTon(toAddress, amount);
        
        return;
    }
    
    // Вывод жетонов
    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        assert(isAllowed(toAddress), ERROR_NOT_IN_WHITELIST);
        
        withdrawJettons(toAddress, amount, queryId);
        
        return;
    }
    
    // Получение жетонов
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getTreasuryData(): (slice, slice, slice, slice, int) {
    loadData();
    
    return (
        ownerAddress,
        walletAddress,
        bankDomAddress,
        domFoundationAddress,
        getBalance().0
    );
}