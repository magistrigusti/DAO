import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

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

// TESTNET: 60 сек. MAINNET: 172800 (48ч)
const TIMELOCK_PERIOD: int = 60;

global adminAddress: address;
global realGasPoolAddress: address;

// Одноразовая конфигурация для проверки sender Wallet.
// Это нужно, чтобы разорвать циклическую зависимость
// на этапе деплоя (master <-> gas_proxy).
global walletConfigReady: bool;
global masterAddress: address;
global jettonWalletCode: cell;

// Timelock
global pendingAddress: address;
global pendingTime: int;
global hasPending: bool;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = contract.getData().beginParse();

    adminAddress = ds.loadAddress();
    realGasPoolAddress = ds.loadAddress();
    walletConfigReady = ds.loadBool();

    if (walletConfigReady) {
        masterAddress = ds.loadAddress();
        jettonWalletCode = ds.loadRef();
    } else {
        masterAddress = adminAddress;
        jettonWalletCode = beginCell().endCell();
    }

    hasPending = ds.loadBool();

    if (hasPending) {
        pendingAddress = ds.loadAddress();
        pendingTime = ds.loadUint(64);
    } else {
        pendingAddress = adminAddress;
        pendingTime = 0;
    }
}

fun saveData() {
    var b = beginCell()
        .storeAddress(adminAddress)
        .storeAddress(realGasPoolAddress)
        .storeBool(walletConfigReady);

    if (walletConfigReady) {
        b = b.storeAddress(masterAddress)
             .storeRef(jettonWalletCode);
    }

    b = b.storeBool(hasPending);

    if (hasPending) {
        b = b.storeAddress(pendingAddress)
             .storeUint(pendingTime, 64);
    }

    contract.setData(b.endCell());
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------

fun assertWalletConfigReady() {
    assert(walletConfigReady, ERROR_PROXY_NOT_CONFIGURED);
}

fun buildWalletData(owner: address): cell {
    assertWalletConfigReady();

    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(contract.getAddress())
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: address): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(wc, stateInit.hash());
}

fun sendInternalTransfer(
    toOwner: address,
    jettonAmount: int,
    fromOwner: address,
    responseDestination: address?,
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
        .storeAddress(fromOwner)
        .storeAddressOpt(responseDestination)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(toWallet)
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

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);

    // =====================================================
    // OP_SET_PROXY_WALLET_CONFIG — одноразовая настройка
    // Только admin. После первого вызова изменить нельзя.
    // Формат body: op | queryId | masterAddress | walletCodeRef
    // =====================================================
    if (op == OP_SET_PROXY_WALLET_CONFIG) {
        assert(
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );
        assert(!walletConfigReady, ERROR_ALREADY_INITIALIZED);

        msgBody.loadUint(64);
        masterAddress = msgBody.loadAddress();
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
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var treasuryFee = msgBody.loadCoins();
        var gasPoolFee = msgBody.loadCoins();

        assertWalletConfigReady();

        var expectedWallet = buildWalletAddress(
            buildWalletStateInit(fromOwner)
        );

        assert(
            senderAddress == expectedWallet,
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
            .storeAddress(toOwner)
            .storeAddress(fromOwner)
            .storeCoins(treasuryFee)
            .storeCoins(gasPoolFee)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(realGasPoolAddress)
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
            senderAddress == realGasPoolAddress,
            ERROR_NOT_ADMIN
        );

        var queryId = msgBody.loadUint(64);
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();

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
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );

        pendingAddress = msgBody.loadAddress();
        pendingTime = blockchain.now() + TIMELOCK_PERIOD;
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
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );

        assert(hasPending, ERROR_NO_PENDING);
        assert(blockchain.now() >= pendingTime, ERROR_TOO_EARLY);

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
            senderAddress == adminAddress,
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

get fun getProxyData(): (address, address, bool) {
    loadData();

    return (
        adminAddress,
        realGasPoolAddress,
        hasPending
    );
}

get fun getWalletConfig(): (bool, address?) {
    loadData();

    if (!walletConfigReady) {
        return (
            false,
            null
        );
    }

    return (
        true,
        masterAddress
    );
}

get fun getPendingChange(): (bool, address?, int) {
    loadData();

    if (!hasPending) {
        return (
            false,
            null,
            0
        );
    }

    return (
        true,
        pendingAddress,
        pendingTime
    );
}