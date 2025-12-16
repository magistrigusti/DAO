// =====================================================
// BANK DAO — Банк системы DAO Dominum
// =====================================================
// Принимает: ЛЮБЫЕ жетоны
// Может: выпускать NFT облигации с купонами
// Управляется: СИД-фраза (owner)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;          // СИД-фраза владельца
global nftCollectionAddress: slice;  // Коллекция NFT облигаций
global totalBonds: int;              // Всего выпущено облигаций
global totalLockedDom: int;          // Заблокировано DOM
global totalLockedTon: int;          // Заблокировано TON

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    nftCollectionAddress = ds.loadMsgAddress();
    totalBonds = ds.loadUint(64);
    totalLockedDom = ds.loadCoins();
    totalLockedTon = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(nftCollectionAddress)
            .storeUint(totalBonds, 64)
            .storeCoins(totalLockedDom)
            .storeCoins(totalLockedTon)
            .endCell()
    );
}

// =====================================================
// МИНТ NFT ОБЛИГАЦИИ
// =====================================================

fun mintBondNft(
    toAddress: slice,
    bondAmount: int,      // Номинал облигации (сколько DOM)
    couponRate: int,      // Ставка купона (в процентах × 100)
    maturityDate: int,    // Дата погашения (timestamp)
    queryId: int
) {
    // NFT Item data
    var nftContent = beginCell()
        .storeCoins(bondAmount)
        .storeUint(couponRate, 16)
        .storeUint(maturityDate, 64)
        .storeSlice(toAddress)
        .endCell();
    
    var msgBody = beginCell()
        .storeUint(OP_MINT_NFT, 32)
        .storeUint(queryId, 64)
        .storeUint(totalBonds, 64)  // item_index
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeRef(nftContent)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(nftCollectionAddress)
        .storeCoins(MIN_TON_FOR_STORAGE * 2)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();
    
    sendRawMessage(msg, 1);
    
    totalBonds += 1;
}

// =====================================================
// ВЫПЛАТА КУПОНА
// =====================================================

fun payCoupon(
    bondHolder: slice,
    couponAmount: int,
    queryId: int
) {
    // Отправляем TON как купон
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(bondHolder)
        .storeCoins(couponAmount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();
    
    sendRawMessage(msg, 1);
}

// =====================================================
// ПОГАШЕНИЕ ОБЛИГАЦИИ
// =====================================================

fun redeemBond(
    bondHolder: slice,
    bondAmount: int,
    queryId: int
) {
    // Возвращаем заблокированные жетоны
    // Здесь логика погашения NFT и возврата DOM
    
    assert(totalLockedDom >= bondAmount, ERROR_NOT_ENOUGH_BALANCE);
    
    totalLockedDom -= bondAmount;
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
        // Простой перевод TON — принимаем
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
    // OP_TRANSFER_NOTIFICATION — получили жетоны
    // Блокируем и можем выпустить облигацию
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        
        // Увеличиваем locked
        totalLockedDom += amount;
        saveData();
        
        return;
    }
    
    // =====================================================
    // OP_ISSUE_BOND — выпустить NFT облигацию
    // Может только owner!
    // =====================================================
    if (op == OP_ISSUE_BOND) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var toAddress = msgBody.loadMsgAddress();
        var bondAmount = msgBody.loadCoins();
        var couponRate = msgBody.loadUint(16);
        var maturityDate = msgBody.loadUint(64);
        
        assert(
            totalLockedDom >= bondAmount,
            ERROR_NOT_ENOUGH_BALANCE
        );
        
        mintBondNft(
            toAddress,
            bondAmount,
            couponRate,
            maturityDate,
            queryId
        );
        
        saveData();
        
        return;
    }
    
    // =====================================================
    // OP_PAY_COUPON — выплатить купон
    // Может только owner!
    // =====================================================
    if (op == OP_PAY_COUPON) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var bondHolder = msgBody.loadMsgAddress();
        var couponAmount = msgBody.loadCoins();
        
        payCoupon(bondHolder, couponAmount, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_REDEEM_BOND — погасить облигацию
    // Владелец NFT отправляет её обратно
    // =====================================================
    if (op == OP_REDEEM_BOND) {
        var bondHolder = msgBody.loadMsgAddress();
        var bondAmount = msgBody.loadCoins();
        
        redeemBond(bondHolder, bondAmount, queryId);
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getBankData(): (slice, slice, int, int, int) {
    loadData();
    return (
        ownerAddress,
        nftCollectionAddress,
        totalBonds,
        totalLockedDom,
        totalLockedTon
    );
}

get fun getTotalLocked(): (int, int) {
    loadData();
    return (totalLockedDom, totalLockedTon);
}