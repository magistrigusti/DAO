// =====================================================
// MANAGER — Контракт управления админами гиверов
// =====================================================
// Управляется: СИД-ФРАЗА #2 (внешний кошелёк)
// Функция: менять admin на гиверах
// Master может: заменить этот контракт на новый
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global adminAddress: slice;   // СИД #2 — кто управляет Manager
global masterAddress: slice;  // Master — владелец (может заменить)

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    adminAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(masterAddress)
            .endCell()
    );
}

// =====================================================
// ОТПРАВКА КОМАНДЫ НА ГИВЕР
// =====================================================

fun sendChangeGiverAdmin(
    giverAddress: slice,
    newAdmin: slice,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_CHANGE_GIVER_ADMIN, 32)
        .storeUint(queryId, 64)
        .storeSlice(newAdmin)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(giverAddress)
        .storeCoins(0)
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
    // OP_CHANGE_GIVER_ADMIN — сменить admin на гивере
    // Может только admin (СИД #2)!
    // =====================================================
    if (op == OP_CHANGE_GIVER_ADMIN) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var giverAddress = msgBody.loadMsgAddress();
        var newAdmin = msgBody.loadMsgAddress();
        
        sendChangeGiverAdmin(giverAddress, newAdmin, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_CHANGE_MANAGER_ADMIN — сменить admin Manager'а
    // Может только Master!
    // =====================================================
    if (op == OP_CHANGE_MANAGER_ADMIN) {
        assert(
            senderAddress.equalSlices(masterAddress),
            ERROR_NOT_MASTER
        );
        
        var newAdmin = msgBody.loadMsgAddress();
        adminAddress = newAdmin;
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getManagerData(): (slice, slice) {
    loadData();
    return (adminAddress, masterAddress);
}