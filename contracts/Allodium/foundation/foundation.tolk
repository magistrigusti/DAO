// =====================================================
// ALLODIUM FOUNDATION — Фонд ликвидности Allodium
// =====================================================
// Принимает: DOM от Giver Allodium / FRS (при разблокировке)
// Функция: накапливает DOM для ликвидности Allodium
// Управляется: СИД-фраза (owner)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;       // СИД-фраза
global walletAddress: slice;      // Jetton Wallet для DOM

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(walletAddress)
            .endCell()
    );
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
// ВЫВОД ЖЕТОНОВ DOM
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
    
    // Получение жетонов DOM
    if (op == OP_TRANSFER_NOTIFICATION) {
        // Просто принимаем
        return;
    }
    
    // Вывод TON (только owner)
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        withdrawTon(toAddress, amount);
        
        return;
    }
    
    // Вывод жетонов (только owner)
    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        withdrawJettons(toAddress, amount, queryId);
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getFoundationData(): (slice, slice, int) {
    loadData();
    
    return (
        ownerAddress,
        walletAddress,
        getBalance().0
    );
}