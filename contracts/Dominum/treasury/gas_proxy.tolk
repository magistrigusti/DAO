import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// GAS PROXY — Прокси для Gas Pool
// =====================================================
// Вечный контракт. Wallet ссылается на него навсегда.
// Пересылает OP_GAS_POOL_EXECUTE на реальный Gas Pool.
// И принимает обратную команду от реального Gas Pool,
// после чего делает OP_INTERNAL_TRANSFER в wallet.
// Админ может менять realGasPoolAddress через timelock.
//
// Timelock: 48 часов между запросом и подтверждением.
// За это время можно заметить взлом и отменить.
//
// Контракт максимально простой = минимум багов.
// =====================================================

// 48 часов в секундах
const TIMELOCK_PERIOD: int = 172800;

global adminAddress: slice;
global realGasPoolAddress: slice;

// Одноразовая конфигурация для проверки sender Wallet.
// Это нужно, чтобы разорвать циклическую зависимость
// на этапе деплоя (master <-> gas_proxy).
global walletConfigReady: int;
global masterAddress: slice;
global jettonWalletCode: cell;

// Timelock
global pendingAddress: slice;
global pendingTime: int;
global hasPending: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun getNullAddress(): slice {
    return beginCell()
        .storeUint(0, 2)
        .endCell()
        .beginParse();
}

fun loadData() {
    var ds = getContractData().beginParse();

    adminAddress = ds.loadMsgAddress();
    realGasPoolAddress = ds.loadMsgAddress();
    walletConfigReady = ds.loadBool();

    if (walletConfigReady) {
        masterAddress = ds.loadMsgAddress();
        jettonWalletCode = ds.loadRef();
    } else {
        masterAddress = getNullAddress();
        jettonWalletCode = beginCell().endCell();
    }

    hasPending = ds.loadBool();

    if (hasPending) {
        pendingAddress = ds.loadMsgAddress();
        pendingTime = ds.loadUint(64);
    }
}

fun saveData() {
    var b = beginCell()
        .storeSlice(adminAddress)
        .storeSlice(realGasPoolAddress)
        .storeBool(walletConfigReady);

    if (walletConfigReady) {
        b = b.storeSlice(masterAddress)
             .storeRef(jettonWalletCode);
    }

    b = b.storeBool(hasPending);

    if (hasPending) {
        b = b.storeSlice(pendingAddress)
             .storeUint(pendingTime, 64);
    }

    setContractData(b.endCell());
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------

fun assertWalletConfigReady() {
    assert(walletConfigReady, ERROR_PROXY_NOT_CONFIGURED);
}

fun buildWalletData(owner: slice): cell {
    assertWalletConfigReady();

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

fun sendInternalTransfer(
    toOwner: slice,
    jettonAmount: int,
    fromOwner: slice,
    responseDestination: slice,
    queryId: int
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
        .storeCoins(0)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
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

    // =====================================================
    // OP_SET_PROXY_WALLET_CONFIG — одноразовая настройка
    // Только admin. После первого вызова изменить нельзя.
    // Формат body: op | queryId | masterAddress | walletCodeRef
    // =====================================================
    if (op == OP_SET_PROXY_WALLET_CONFIG) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );
        assert(!walletConfigReady, ERROR_ALREADY_INITIALIZED);

        msgBody.loadUint(64);
        masterAddress = msgBody.loadMsgAddress();
        jettonWalletCode = msgBody.loadRef();
        walletConfigReady = true;
        saveData();

        return;
    }

    // =====================================================
    // OP_GAS_POOL_EXECUTE — от Wallet
    // Пересылаем на реальный Gas Pool
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        var queryId = msgBody.loadUint(64);
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var fromOwner = msgBody.loadMsgAddress();
        var treasuryFee = msgBody.loadCoins();
        var gasPoolFee = msgBody.loadCoins();

        assertWalletConfigReady();

        var expectedWallet = buildWalletAddress(
            buildWalletStateInit(fromOwner)
        );

        assert(
            senderAddress.equalSlices(expectedWallet),
            ERROR_NOT_VALID_WALLET
        );

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        // Фиксированные комиссии без курса.
        assert(treasuryFee == TAX_AMOUNT, ERROR_INVALID_AMOUNT);
        assert(gasPoolFee == TAX_HALF, ERROR_INVALID_AMOUNT);

        var fullBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeSlice(toOwner)
            .storeSlice(fromOwner)
            .storeCoins(treasuryFee)
            .storeCoins(gasPoolFee)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(realGasPoolAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(fullBody)
            .endCell();

        sendRawMessage(msg, 64);

        return;
    }

    // =====================================================
    // OP_PROXY_INTERNAL_TRANSFER — от реального Gas Pool
    // Прокси делает OP_INTERNAL_TRANSFER в нужный wallet
    // =====================================================
    if (op == OP_PROXY_INTERNAL_TRANSFER) {
        assert(
            senderAddress.equalSlices(realGasPoolAddress),
            ERROR_NOT_ADMIN
        );

        var queryId = msgBody.loadUint(64);
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var fromOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);
        assertWalletConfigReady();

        sendInternalTransfer(
            toOwner,
            jettonAmount,
            fromOwner,
            responseDestination,
            queryId
        );

        return;
    }

    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_REQUEST_CHANGE_POOL — запрос смены (48ч timelock)
    // Только admin
    // =====================================================
    if (op == OP_REQUEST_CHANGE_POOL) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        pendingAddress = msgBody.loadMsgAddress();
        pendingTime = now() + TIMELOCK_PERIOD;
        hasPending = true;
        saveData();

        return;
    }

    // =====================================================
    // OP_CONFIRM_CHANGE_POOL — подтверждение (после 48ч)
    // Только admin
    // =====================================================
    if (op == OP_CONFIRM_CHANGE_POOL) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        assert(hasPending, ERROR_NO_PENDING);
        assert(now() >= pendingTime, ERROR_TOO_EARLY);

        realGasPoolAddress = pendingAddress;
        hasPending = false;
        saveData();

        return;
    }

    // =====================================================
    // OP_CANCEL_CHANGE_POOL — отмена запроса
    // Только admin. Можно в любой момент.
    // =====================================================
    if (op == OP_CANCEL_CHANGE_POOL) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        hasPending = false;
        saveData();

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getProxyData(): (slice, slice, int) {
    loadData();

    return (
        adminAddress,
        realGasPoolAddress,
        hasPending
    );
}

get fun getWalletConfig(): (int, slice) {
    loadData();

    if (!walletConfigReady) {
        return (
            false,
            getNullAddress()
        );
    }

    return (
        true,
        masterAddress
    );
}

get fun getPendingChange(): (int, slice, int) {
    loadData();

    if (!hasPending) {
        return (
            false,
            beginCell()
                .storeUint(0, 2)
                .endCell()
                .beginParse(),
            0
        );
    }

    return (
        true,
        pendingAddress,
        pendingTime
    );
}