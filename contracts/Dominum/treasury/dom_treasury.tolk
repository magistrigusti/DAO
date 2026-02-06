import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// DOM TREASURY — Единое казначейство Dominum
// =====================================================
// Принимает: налог от Gas Pool
// Отправляет: ТОЛЬКО на банки (whitelist)
// Управляется: СИД-фраза владельца
// Админа НЕТ — адреса жёстко зашиты при деплое!
// =====================================================

global ownerAddress: slice;           // СИД-фраза владельца
global jettonWalletAddress: slice;    // Jetton Wallet казначейства

// Whitelist — 3 банка (ЖЁСТКО при деплое!)
global bankDaoAddress: slice;
global bankDefiAddress: slice;
global bankDominumAddress: slice;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();
    
    ownerAddress = ds.loadMsgAddress();
    jettonWalletAddress = ds.loadMsgAddress();
    
    bankDaoAddress = ds.loadMsgAddress();
    bankDefiAddress = ds.loadMsgAddress();
    bankDominumAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(jettonWalletAddress)
            .storeSlice(bankDaoAddress)
            .storeSlice(bankDefiAddress)
            .storeSlice(bankDominumAddress)
            .endCell()
    );
}

// -----------------------------------------------------
// ПРОВЕРКА WHITELIST
// -----------------------------------------------------

fun isWhitelisted(address: slice): int {
    if (address.equalSlices(bankDaoAddress)) {
        return true;
    }
    if (address.equalSlices(bankDefiAddress)) {
        return true;
    }
    if (address.equalSlices(bankDominumAddress)) {
        return true;
    }
    return false;
}

// -----------------------------------------------------
// ВЫВОД TON
// -----------------------------------------------------

fun withdrawTon(toAddress: slice, amount: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    
    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ВЫВОД DOM (через Jetton Wallet)
// -----------------------------------------------------

fun withdrawDom(toAddress: slice, amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress)        // response_destination
        .storeBool(false)                // no custom_payload
        .storeCoins(0)                   // forward_ton_amount
        .storeBool(false)                // no forward_payload
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(jettonWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
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
    // Пустое сообщение — просто принимаем TON
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
    // OP_TRANSFER_NOTIFICATION — получили DOM (налог)
    // Просто принимаем, ничего не делаем
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW — вывести TON (только owner, только whitelist)
    // =====================================================
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        // ТОЛЬКО НА БАНКИ!
        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);
        
        withdrawTon(toAddress, amount, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW_JETTONS — вывести DOM (только owner, только whitelist)
    // =====================================================
    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        
        // ТОЛЬКО НА БАНКИ!
        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);
        
        withdrawDom(toAddress, amount, queryId);
        
        return;
    }
    
    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getTreasuryData(): (slice, slice, slice, slice, slice, int) {
    loadData();
    
    return (
        ownerAddress,
        jettonWalletAddress,
        bankDaoAddress,
        bankDefiAddress,
        bankDominumAddress,
        getBalance().0
    );
}

get fun isAddressWhitelisted(address: slice): int {
    loadData();
    return isWhitelisted(address);
}