// =====================================================
// JETTON WALLET — Кошелёк токена DOM с налогом
// =====================================================
// Стандарт: TEP-74 (Jetton Wallet)
// 
// Налог 0.05 TON при ОТПРАВКЕ (OP_TRANSFER):
// ├─► 0.025 TON → DOM Treasury
// └─► 0.025 TON → DAO Treasury
//
// При bounced — налог НЕ возвращается!
// Получатель получает 100% токенов
// =====================================================

import "../../core/op_codes";
import "../../core/errors";
import "../../core/constants";

// =====================================================
// STORAGE
// =====================================================

global balance: int;
global ownerAddress: slice;
global masterAddress: slice;
global domTreasuryAddress: slice;  // DOM Treasury (50%)
global daoTreasuryAddress: slice;  // DAO Treasury (50%)

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    
    balance = ds.loadCoins();
    ownerAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
    domTreasuryAddress = ds.loadMsgAddress();
    daoTreasuryAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeCoins(balance)
            .storeSlice(ownerAddress)
            .storeSlice(masterAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(daoTreasuryAddress)
            .endCell()
    );
}

// =====================================================
// НАЛОГ — только при отправке!
// =====================================================

fun sendTax(queryId: int) {
    // 0.025 TON → DOM Treasury
    var msgDom = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(domTreasuryAddress)
        .storeCoins(TAX_HALF)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeUint(OP_RECEIVE_TAX, 32)
        .storeUint(queryId, 64)
        .endCell();
    
    sendRawMessage(msgDom, 1);
    
    // 0.025 TON → DAO Treasury
    var msgDao = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(daoTreasuryAddress)
        .storeCoins(TAX_HALF)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeUint(OP_RECEIVE_TAX, 32)
        .storeUint(queryId, 64)
        .endCell();
    
    sendRawMessage(msgDao, 1);
}

// =====================================================
// ОТПРАВКА ТОКЕНОВ
// =====================================================

fun sendTokens(
    toAddress: slice,
    jettonAmount: int,
    responseAddress: slice,
    queryId: int,
    forwardTonAmount: int,
    forwardPayload: slice
) {
    var msgBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(ownerAddress)
        .storeSlice(responseAddress)
        .storeCoins(forwardTonAmount)
        .storeSlice(forwardPayload)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toAddress)
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
    
    // =====================================================
    // BOUNCED — возвращаем токены, НО НЕ налог!
    // =====================================================
    if (flags & 1) {
        msgBody.skipBits(32);
        var op = msgBody.loadUint(32);
        
        if (op == OP_INTERNAL_TRANSFER) {
            msgBody.skipBits(64);
            var bouncedAmount = msgBody.loadCoins();
            
            loadData();
            balance = balance + bouncedAmount;
            saveData();
            // Налог уже ушёл — не возвращаем!
        }
        return;
    }
    
    var senderAddress = cs.loadMsgAddress();
    
    loadData();
    
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // =====================================================
    // OP_TRANSFER — отправка (ЗДЕСЬ НАЛОГ!)
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        assert(
            msgValue >= MIN_TON_FOR_TRANSFER,
            ERROR_INSUFFICIENT_GAS
        );
        
        var jettonAmount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        var responseAddress = msgBody.loadMsgAddress();
        msgBody.skipBits(1);
        var forwardTonAmount = msgBody.loadCoins();
        var forwardPayload = msgBody;
        
        assert(
            balance >= jettonAmount,
            ERROR_INSUFFICIENT_BALANCE
        );
        
        // Уменьшаем баланс
        balance = balance - jettonAmount;
        saveData();
        
        // Отправляем токены
        sendTokens(
            toAddress,
            jettonAmount,
            responseAddress,
            queryId,
            forwardTonAmount,
            forwardPayload
        );
        
        // НАЛОГ! Отправитель платит при отправке
        sendTax(queryId);
        
        return;
    }
    
    // =====================================================
    // OP_INTERNAL_TRANSFER — получение (БЕЗ налога!)
    // =====================================================
    if (op == OP_INTERNAL_TRANSFER) {
        var jettonAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        var responseAddress = msgBody.loadMsgAddress();
        var forwardTonAmount = msgBody.loadCoins();
        
        // Увеличиваем баланс
        balance = balance + jettonAmount;
        saveData();
        
        // Налога НЕТ — его заплатил отправитель!
        
        // Уведомление владельца
        if (forwardTonAmount > 0) {
            var forwardPayload = msgBody;
            
            var msgNotify = beginCell()
                .storeUint(0x10, 6)
                .storeSlice(ownerAddress)
                .storeCoins(forwardTonAmount)
                .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeRef(
                    beginCell()
                        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
                        .storeUint(queryId, 64)
                        .storeCoins(jettonAmount)
                        .storeSlice(fromAddress)
                        .storeSlice(forwardPayload)
                        .endCell()
                )
                .endCell();
            
            sendRawMessage(msgNotify, 1);
        }
        
        // Возврат excesses
        if (~ responseAddress.isAddressNone()) {
            var msgExcess = beginCell()
                .storeUint(0x10, 6)
                .storeSlice(responseAddress)
                .storeCoins(0)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeUint(OP_EXCESSES, 32)
                .storeUint(queryId, 64)
                .endCell();
            
            sendRawMessage(msgExcess, 64 + 2);
        }
        
        return;
    }
    
    // =====================================================
    // OP_BURN — сжигание (НАЛОГ!)
    // =====================================================
    if (op == OP_BURN) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var jettonAmount = msgBody.loadCoins();
        var responseAddress = msgBody.loadMsgAddress();
        
        assert(
            balance >= jettonAmount,
            ERROR_INSUFFICIENT_BALANCE
        );
        
        assert(
            msgValue >= TAX_AMOUNT,
            ERROR_INSUFFICIENT_GAS
        );
        
        balance = balance - jettonAmount;
        saveData();
        
        // Уведомляем Master
        var msgBurn = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(masterAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(
                beginCell()
                    .storeUint(OP_BURN_NOTIFICATION, 32)
                    .storeUint(queryId, 64)
                    .storeCoins(jettonAmount)
                    .storeSlice(ownerAddress)
                    .storeSlice(responseAddress)
                    .endCell()
            )
            .endCell();
        
        sendRawMessage(msgBurn, 64);
        
        // НАЛОГ!
        sendTax(queryId);
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getWalletData(): (int, slice, slice, cell) {
    loadData();
    
    return (
        balance,
        ownerAddress,
        masterAddress,
        getContractCode()
    );
}