// =====================================================
// GAS POOL — Пул для оплаты газа в DOM
// =====================================================
// Принимает: DOM (как оплата за газ)
// Отдаёт: TON на контракты (для оплаты газа валидаторам)
// Управляется: Bank Dominum (через СИД-фразу)
// =====================================================

import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// =====================================================
// STORAGE
// =====================================================

global bankDominumAddress: slice;  // Bank Dominum (владелец!)
global domWalletAddress: slice;    // Наш Wallet DOM
global tonReserve: int;            // Резерв TON в пуле
global domReserve: int;            // Накопленный DOM
global exchangeRate: int;          

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    bankDominumAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
    tonReserve = ds.loadCoins();
    domReserve = ds.loadCoins();
    exchangeRate = ds.loadUint(32);
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(bankDominumAddress)
            .storeSlice(domWalletAddress)
            .storeCoins(tonReserve)
            .storeCoins(domReserve)
            .storeUint(exchangeRate, 32)
            .endCell()
    );
}

// =====================================================
// РАСЧЁТ TON ПО КУРСУ
// =====================================================

fun calculateTonForDom(domAmount: int): int {
    return domAmount * exchangeRate / 1000;
}

// =====================================================
// ПОПОЛНЕНИЕ КОНТРАКТА TON'ом
// =====================================================

fun refillContractWithTon(
    contractAddress: slice,
    tonAmount: int,
    queryId: int
) {
    assert(tonReserve >= tonAmount, ERROR_NOT_ENOUGH_BALANCE);
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(contractAddress)
        .storeCoins(tonAmount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();
    
    sendRawMessage(msg, 1);
    
    tonReserve -= tonAmount;
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
    // Простой перевод TON — пополнение резерва
    if (msgBody.isEndOfSlice()) {
        loadData();
        tonReserve += msgValue;
        saveData();
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
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // Это оплата за газ — автоматически пополняем TON
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        var domAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        
        domReserve += domAmount;
        
        // Автоматически пополняем TON контракту который прислал DOM
        var tonToRefill = calculateTonForDom(domAmount);
        
        if (tonReserve >= tonToRefill) {
            refillContractWithTon(fromAddress, tonToRefill, queryId);
        }
        
        saveData();
        
        return;
    }
    
    // =====================================================
    // КОМАНДЫ ОТ BANK DOMINUM
    // Только Bank Dominum может управлять!
    // =====================================================
    
    // OP_UPDATE_RATE — обновить курс
    if (op == OP_UPDATE_RATE) {
        assert(
            senderAddress.equalSlices(bankDominumAddress),
            ERROR_NOT_OWNER
        );
        
        var newRate = msgBody.loadUint(32);
        exchangeRate = newRate;
        saveData();
        
        return;
    }
    
    // OP_REFILL_CONTRACT — пополнить контракт TON
    if (op == OP_REFILL_CONTRACT) {
        assert(
            senderAddress.equalSlices(bankDominumAddress),
            ERROR_NOT_OWNER
        );
        
        var contractAddress = msgBody.loadMsgAddress();
        var tonAmount = msgBody.loadCoins();
        
        refillContractWithTon(contractAddress, tonAmount, queryId);
        saveData();
        
        return;
    }
    
    // OP_WITHDRAW_DOM — вывести накопленный DOM
    if (op == OP_WITHDRAW_DOM) {
        assert(
            senderAddress.equalSlices(bankDominumAddress),
            ERROR_NOT_OWNER
        );
        
        var toAddress = msgBody.loadMsgAddress();
        var amount = msgBody.loadCoins();
        
        assert(domReserve >= amount, ERROR_NOT_ENOUGH_BALANCE);
        
        var transferBody = beginCell()
            .storeUint(OP_TRANSFER, 32)
            .storeUint(queryId, 64)
            .storeCoins(amount)
            .storeSlice(toAddress)
            .storeSlice(bankDominumAddress)
            .storeBool(false)
            .storeCoins(0)
            .storeBool(false)
            .endCell();
        
        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(domWalletAddress)
            .storeCoins(MIN_TON_FOR_TRANSFER)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(transferBody)
            .endCell();
        
        sendRawMessage(msg, 1);
        
        domReserve -= amount;
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getPoolData(): (slice, int, int, int) {
    loadData();
    return (
        bankDominumAddress,
        tonReserve,
        domReserve,
        exchangeRate
    );
}

get fun calculateGasCost(domAmount: int): int {
    loadData();
    return calculateTonForDom(domAmount);
}