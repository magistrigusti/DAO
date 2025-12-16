// =====================================================
// DAO FOUNDATION — Фонд DAO Dominum
// =====================================================
// Принимает: ТОЛЬКО DOM, TON, ETH
// Может: выпускать акции (shares)
// Управляется: СИД-фраза (owner)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;          // СИД-фраза владельца
global sharesCollectionAddress: slice;  // Коллекция акций (NFT/SBT)
global totalShares: int;             // Всего выпущено акций
global totalDom: int;                // Баланс DOM
global totalTon: int;                // Баланс TON
global domWalletAddress: slice;      // Jetton Wallet DOM
global ethWalletAddress: slice;      // Jetton Wallet ETH (wrapped)

// Whitelist разрешённых жетонов
global allowedDomMaster: slice;      // Master DOM
global allowedEthMaster: slice;      // Master wETH

// =====================================================
// LOAD / SAVE DATA
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    sharesCollectionAddress = ds.loadMsgAddress();
    totalShares = ds.loadUint(64);
    totalDom = ds.loadCoins();
    totalTon = ds.loadCoins();
    domWalletAddress = ds.loadMsgAddress();
    
    var ref = ds.loadRef().beginParse();
    ethWalletAddress = ref.loadMsgAddress();
    allowedDomMaster = ref.loadMsgAddress();
    allowedEthMaster = ref.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(sharesCollectionAddress)
            .storeUint(totalShares, 64)
            .storeCoins(totalDom)
            .storeCoins(totalTon)
            .storeSlice(domWalletAddress)
            .storeRef(
                beginCell()
                    .storeSlice(ethWalletAddress)
                    .storeSlice(allowedDomMaster)
                    .storeSlice(allowedEthMaster)
                    .endCell()
            )
            .endCell()
    );
}

// =====================================================
// ПРОВЕРКА РАЗРЕШЁННЫХ ЖЕТОНОВ
// =====================================================

fun isAllowedJetton(masterAddress: slice): int {
    if (masterAddress.equalSlices(allowedDomMaster)) {
        return true;
    }
    if (masterAddress.equalSlices(allowedEthMaster)) {
        return true;
    }
    return false;
}

// =====================================================
// МИНТ АКЦИИ (SHARE NFT)
// =====================================================

fun mintShare(
    toAddress: slice,
    shareValue: int,      // Стоимость акции в DOM
    shareType: int,       // Тип акции (0 = обычная, 1 = привилегированная)
    queryId: int
) {
    var shareContent = beginCell()
        .storeCoins(shareValue)
        .storeUint(shareType, 8)
        .storeSlice(toAddress)
        .storeUint(now(), 64)  // Дата выпуска
        .endCell();
    
    var msgBody = beginCell()
        .storeUint(OP_MINT_NFT, 32)
        .storeUint(queryId, 64)
        .storeUint(totalShares, 64)  // share_index
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeRef(shareContent)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(sharesCollectionAddress)
        .storeCoins(MIN_TON_FOR_STORAGE * 2)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();
    
    sendRawMessage(msg, 1);
    
    totalShares += 1;
}

// =====================================================
// РАСПРЕДЕЛЕНИЕ НА 5 КОНТРАКТОВ ПРИБЫЛИ
// =====================================================

global profitContract1: slice;  // Пул DOM/USDT
global profitContract2: slice;  // Пул DOM/TON
global profitContract3: slice;  // Стейкинг
global profitContract4: slice;  // Резерв
global profitContract5: slice;  // Развитие

fun distributeToProfitContracts(
    amount: int,
    proportions: cell,  // 5 чисел по 16 бит (проценты)
    queryId: int
) {
    // TODO: реализовать распределение по пропорциям
    // Это будет вызываться владельцем для распределения
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
        loadData();
        totalTon += msgValue;
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
    // OP_TRANSFER_NOTIFICATION — получили жетоны
    // Только DOM или ETH!
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();
        
        // Проверяем что жетон разрешён
        // sender = наш wallet, проверяем по адресу
        if (senderAddress.equalSlices(domWalletAddress)) {
            totalDom += amount;
            saveData();
            return;
        }
        
        if (senderAddress.equalSlices(ethWalletAddress)) {
            // ETH учитываем отдельно если нужно
            saveData();
            return;
        }
        
        // Неразрешённый жетон — отклоняем
        throw(ERROR_NOT_IN_WHITELIST);
    }
    
    // =====================================================
    // OP_ISSUE_SHARE — выпустить акцию
    // Может только owner!
    // =====================================================
    if (op == OP_ISSUE_SHARE) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var toAddress = msgBody.loadMsgAddress();
        var shareValue = msgBody.loadCoins();
        var shareType = msgBody.loadUint(8);
        
        mintShare(toAddress, shareValue, shareType, queryId);
        saveData();
        
        return;
    }
    
    // =====================================================
    // OP_DISTRIBUTE_PROFIT — распределить на 5 контрактов
    // Может только owner!
    // =====================================================
    if (op == OP_DISTRIBUTE_PROFIT) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        var proportions = msgBody.loadRef();
        
        distributeToProfitContracts(amount, proportions, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW — вывести средства
    // Может только owner!
    // =====================================================
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var toAddress = msgBody.loadMsgAddress();
        var amount = msgBody.loadCoins();
        var assetType = msgBody.loadUint(8);  // 0=TON, 1=DOM, 2=ETH
        
        if (assetType == 0) {
            // Вывод TON
            assert(totalTon >= amount, ERROR_NOT_ENOUGH_BALANCE);
            
            var msg = beginCell()
                .storeUint(0x18, 6)
                .storeSlice(toAddress)
                .storeCoins(amount)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .endCell();
            
            sendRawMessage(msg, 1);
            totalTon -= amount;
        }
        
        // TODO: добавить вывод DOM и ETH через их wallet'ы
        
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getFoundationData(): (slice, slice, int, int, int) {
    loadData();
    return (
        ownerAddress,
        sharesCollectionAddress,
        totalShares,
        totalDom,
        totalTon
    );
}

get fun getTotalAssets(): (int, int) {
    loadData();
    return (totalDom, totalTon);
}

get fun getAllowedJettons(): (slice, slice) {
    loadData();
    return (allowedDomMaster, allowedEthMaster);
}