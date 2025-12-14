// =====================================================
// FRS ALLODIUM — Резервная система токена ALLOD
// =====================================================
// Принимает: DOM от Giver Allodium
// Разблокирует: DOM на Allodium Foundation
// Функция: блокирует DOM, отправляет разрешение Master ALLOD
// Курс: 1 DOM = 1000 ALLOD
// Управляется: СИД-фраза (owner)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;               // СИД-фраза
global domWalletAddress: slice;           // Jetton Wallet FRS для DOM
global allodMasterAddress: slice;         // Master ALLOD
global giverAllodiumAddress: slice;       // откуда принимаем DOM
global allodiumFoundationAddress: slice;  // куда отправляем при разблокировке
global lockedDom: int;                    // заблокировано DOM

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
    allodMasterAddress = ds.loadMsgAddress();
    giverAllodiumAddress = ds.loadMsgAddress();
    allodiumFoundationAddress = ds.loadMsgAddress();
    lockedDom = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(domWalletAddress)
            .storeSlice(allodMasterAddress)
            .storeSlice(giverAllodiumAddress)
            .storeSlice(allodiumFoundationAddress)
            .storeCoins(lockedDom)
            .endCell()
    );
}

// =====================================================
// ОТПРАВКА РАЗРЕШЕНИЯ НА MASTER ALLOD
// =====================================================

fun sendMintAllowance(allowanceAmount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_INCREASE_MINT_ALLOWANCE, 32)
        .storeUint(queryId, 64)
        .storeCoins(allowanceAmount)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(allodMasterAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();
    
    sendRawMessage(msg, 64);
}

// =====================================================
// РАЗБЛОКИРОВКА DOM → ALLODIUM FOUNDATION
// =====================================================

fun unlockDom(amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(allodiumFoundationAddress)  // → Allodium Foundation!
        .storeSlice(ownerAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(domWalletAddress)
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
    
    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // Только от Giver Allodium!
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        var domAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        
        assert(
            senderAddress.equalSlices(domWalletAddress),
            ERROR_NOT_VALID_WALLET
        );
        
        assert(
            fromAddress.equalSlices(giverAllodiumAddress),
            ERROR_NOT_IN_WHITELIST
        );
        
        // Блокируем DOM
        lockedDom = lockedDom + domAmount;
        saveData();
        
        // Разрешение: 1 DOM = 1000 ALLOD
        var allowanceAmount = domAmount * EXCHANGE_RATE_DOM_TO_ALLOD;
        
        // Отправляем разрешение на Master ALLOD
        sendMintAllowance(allowanceAmount, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_ALLOD_BURNED — ALLOD сожжён, разблокируем DOM
    // Только от Master ALLOD!
    // =====================================================
    if (op == OP_ALLOD_BURNED) {
        assert(
            senderAddress.equalSlices(allodMasterAddress),
            ERROR_NOT_MASTER
        );
        
        var burnedAllod = msgBody.loadCoins();
        
        var domToUnlock = burnedAllod / EXCHANGE_RATE_DOM_TO_ALLOD;
        
        assert(
            lockedDom >= domToUnlock,
            ERROR_INSUFFICIENT_BALANCE
        );
        
        lockedDom = lockedDom - domToUnlock;
        saveData();
        
        // Отправляем DOM на Allodium Foundation
        unlockDom(domToUnlock, queryId);
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getFrsData(): (slice, slice, slice, slice, slice, int) {
    loadData();
    
    return (
        ownerAddress,
        domWalletAddress,
        allodMasterAddress,
        giverAllodiumAddress,
        allodiumFoundationAddress,
        lockedDom
    );
}

get fun getLockedDom(): int {
    loadData();
    return lockedDom;
}

get fun getMaxAllod(): int {
    loadData();
    return lockedDom * EXCHANGE_RATE_DOM_TO_ALLOD;
}