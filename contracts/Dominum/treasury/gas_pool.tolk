import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// GAS POOL — пул газа
// =====================================================
// Принимает DOM комиссию от Wallet.
// Делает все transfers используя СВОЙ баланс TON.
// Возвращает TON пользователю (gasless).
//
// Пополняется TON через Bank Dominum.
// =====================================================

global adminAddress: slice;           // Bank Dominum (пополняет TON)
global treasuryManagerAddress: slice; // Treasury Manager (управление)

global domTreasuryAddress: slice;     // куда налог 1
global daoTreasuryAddress: slice;     // куда налог 2

global masterAddress: slice;          // DOM Master
global jettonWalletCode: cell;        // код Jetton Wallet

global domBalance: int;               // накопленный DOM
global tonReserve: int;               // минимальный резерв TON

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();
    
    adminAddress = ds.loadMsgAddress();
    treasuryManagerAddress = ds.loadMsgAddress();
    
    domTreasuryAddress = ds.loadMsgAddress();
    daoTreasuryAddress = ds.loadMsgAddress();
    
    masterAddress = ds.loadMsgAddress();
    jettonWalletCode = ds.loadRef();
    
    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(treasuryManagerAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(daoTreasuryAddress)
            .storeSlice(masterAddress)
            .storeRef(jettonWalletCode)
            .storeCoins(domBalance)
            .storeCoins(tonReserve)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------

fun buildWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(masterAddress)
        .storeSlice(myAddress())
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
    var walletData = buildWalletData(owner);
    
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// -----------------------------------------------------
// SEND INTERNAL TRANSFER (Jetton)
// -----------------------------------------------------

fun sendInternalTransfer(
    toOwner: slice,
    jettonAmount: int,
    fromOwner: slice,
    responseDestination: slice,
    queryId: int,
    msgValue: int
) {
    if (jettonAmount <= 0) {
        return;
    }
    
    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(stateInit);
    
    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(fromOwner)
        .storeSlice(responseDestination)
        .storeCoins(0)
        .storeBool(false)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toWallet)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();
    
    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// SEND TON (простой перевод)
// -----------------------------------------------------

fun sendTon(to: slice, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }
    
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(to)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
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
    // Пустое сообщение — пополнение TON
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
    // OP_GAS_POOL_EXECUTE — выполнить transfer
    // Приходит от Jetton Wallet пользователя
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        // Читаем данные из сообщения
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var fromOwner = msgBody.loadMsgAddress();
        var domTreasuryFee = msgBody.loadCoins();
        var daoTreasuryFee = msgBody.loadCoins();
        var gasPoolFee = msgBody.loadCoins();
        
        // Проверяем что отправитель — валидный Jetton Wallet
        var expectedWallet = buildWalletAddress(
            buildWalletStateInit(fromOwner)
        );
        
        assert(
            senderAddress.equalSlices(expectedWallet),
            ERROR_NOT_VALID_WALLET
        );
        
        // Сколько TON нужно на 3 сообщения + возврат
        var tonForTransfers = MIN_TON_FOR_STORAGE * 3;
        var tonToReturn = msgValue;
        
        // Проверяем что хватает TON в пуле
        var availableTon = myBalance - tonReserve;
        assert(availableTon >= tonForTransfers, ERROR_INSUFFICIENT_GAS);
        
        // Накапливаем DOM (комиссия пула)
        domBalance += gasPoolFee;
        saveData();
        
        // =====================================================
        // ВЫПОЛНЯЕМ TRANSFERS (из нашего TON)
        // =====================================================
        
        // 1) Получателю — основная сумма
        sendInternalTransfer(
            toOwner,
            jettonAmount,
            fromOwner,
            fromOwner,
            queryId,
            MIN_TON_FOR_STORAGE
        );
        
        // 2) DOM Treasury — налог
        sendInternalTransfer(
            domTreasuryAddress,
            domTreasuryFee,
            fromOwner,
            fromOwner,
            queryId + 1,
            MIN_TON_FOR_STORAGE
        );
        
        // 3) DAO Treasury — налог
        sendInternalTransfer(
            daoTreasuryAddress,
            daoTreasuryFee,
            fromOwner,
            fromOwner,
            queryId + 2,
            MIN_TON_FOR_STORAGE
        );
        
        // 4) Возвращаем TON пользователю (gasless!)
        sendTon(fromOwner, tonToReturn, queryId + 3);
        
        return;
    }
    
    // =====================================================
    // OP_TOP_UP — пополнение TON (только admin)
    // =====================================================
    if (op == OP_TOP_UP) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        // TON уже на балансе, просто принимаем
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW_DOM — вывести накопленный DOM (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_DOM) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var amount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        
        assert(amount <= domBalance, ERROR_INSUFFICIENT_BALANCE);
        
        domBalance -= amount;
        saveData();
        
        sendInternalTransfer(
            toOwner,
            amount,
            myAddress(),
            adminAddress,
            queryId,
            MIN_TON_FOR_STORAGE
        );
        
        return;
    }
    
    // =====================================================
    // OP_WITHDRAW_TON — вывести TON (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_TON) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        
        var amount = msgBody.loadCoins();
        var to = msgBody.loadMsgAddress();
        
        var availableTon = myBalance - tonReserve - msgValue;
        assert(amount <= availableTon, ERROR_INSUFFICIENT_BALANCE);
        
        sendTon(to, amount, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_SET_RESERVE — установить минимальный резерв TON
    // =====================================================
    if (op == OP_SET_RESERVE) {
        assert(
            senderAddress.equalSlices(treasuryManagerAddress),
            ERROR_NOT_ADMIN
        );
        
        tonReserve = msgBody.loadCoins();
        saveData();
        
        return;
    }
    
    // =====================================================
    // OP_CHANGE_ADMIN — сменить admin
    // =====================================================
    if (op == OP_CHANGE_ADMIN) {
        assert(
            senderAddress.equalSlices(treasuryManagerAddress),
            ERROR_NOT_ADMIN
        );
        
        adminAddress = msgBody.loadMsgAddress();
        saveData();
        
        return;
    }
    
    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getPoolData(): (slice, slice, int, int, int) {
    loadData();
    
    var availableTon = getContractBalance() - tonReserve;
    
    return (
        adminAddress,
        treasuryManagerAddress,
        domBalance,
        tonReserve,
        availableTon
    );
}

get fun getExchangeRate(): int {
    // Курс DOM/TON рассчитывается off-chain
    // Здесь можно добавить oracle в будущем
    return 1000000; // 1 DOM = 1 TON (placeholder)
}