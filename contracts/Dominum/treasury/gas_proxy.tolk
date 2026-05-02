import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// GAS PROXY v2:
// - переводчик между DOM-wallet и реальным gas_pool
// - хранит адрес realGasPoolAddress (меняется через timelock)
// - знает новый формат OP_GAS_POOL_EXECUTE:
//   (amount, toOwner, fromOwner, maxFeeDom)
// - валидирует что sender — настоящий DOM-wallet
// - назад из gas_pool получает OP_PROXY_INTERNAL_TRANSFER
//   и пересылает как OP_INTERNAL_TRANSFER в нужный wallet
// ========================================

// TESTNET: 60 сек. MAINNET: 172800 (48ч)
const TIMELOCK_PERIOD: int = 60;

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global managerAddress: address;
global realGasPoolAddress: address;

// Одноразовая конфигурация для проверки sender-wallet.
// Нужно чтобы разорвать циклическую зависимость
// master ↔ proxy на этапе деплоя.
global walletConfigReady: bool;
global masterAddress: address;
global jettonWalletCode: cell;

// Timelock смены realGasPoolAddress
global pendingAddress: address;
global pendingTime: int;
global hasPending: bool;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    managerAddress = ds.loadAddress();
    realGasPoolAddress = ds.loadAddress();
    walletConfigReady = ds.loadBool();

    if (walletConfigReady) {
        masterAddress = ds.loadAddress();
        jettonWalletCode = ds.loadRef();
    } else {
        masterAddress = managerAddress;
        jettonWalletCode = beginCell().endCell();
    }

    hasPending = ds.loadBool();

    if (hasPending) {
        pendingAddress = ds.loadAddress();
        pendingTime = ds.loadUint(64);
    } else {
        pendingAddress = managerAddress;
        pendingTime = 0;
    }
}

fun saveData() {
    var b = beginCell()
        .storeAddress(managerAddress)
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
    assert(
        walletConfigReady,
        ERROR_PROXY_NOT_CONFIGURED
    );
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
    return address.fromWorkchainAndHash(
        wc,
        stateInit.hash()
    );
}

// -----------------------------------------------------
// ОТПРАВКА OP_INTERNAL_TRANSFER В WALLET ПОЛУЧАТЕЛЯ
// -----------------------------------------------------
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
    // Только manager. После первого вызова изменить нельзя.
    // body: queryId | masterAddress | jettonWalletCode
    // =====================================================
    if (op == OP_SET_PROXY_WALLET_CONFIG) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );
        assert(
            !walletConfigReady,
            ERROR_ALREADY_INITIALIZED
        );

        msgBody.loadUint(64);
        masterAddress = msgBody.loadAddress();
        jettonWalletCode = msgBody.loadRef();
        walletConfigReady = true;
        saveData();

        return;
    }

    // =====================================================
    // OP_GAS_POOL_EXECUTE — от DOM-wallet
    // body v2: queryId | amount | toOwner | fromOwner | maxFeeDom
    // Пересылаем на realGasPool в таком же формате.
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        var queryId = msgBody.loadUint(64);
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var maxFeeDom = msgBody.loadCoins();

        assertWalletConfigReady();

        // Проверка: sender действительно wallet юзера fromOwner
        var expectedWallet = buildWalletAddress(
            buildWalletStateInit(fromOwner)
        );

        assert(
            senderAddress == expectedWallet,
            ERROR_NOT_VALID_WALLET
        );

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(maxFeeDom > 0, ERROR_INVALID_AMOUNT);

        var fullBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(toOwner)
            .storeAddress(fromOwner)
            .storeCoins(maxFeeDom)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(realGasPoolAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(fullBody)
            .endCell();

        // mode 64 — carry remaining value от wallet
        sendRawMessage(msg, 64);
        return;
    }

    // =====================================================
    // OP_PROXY_INTERNAL_TRANSFER — от реального gas_pool
    // body: queryId | amount | toOwner | fromOwner | responseDest
    // Делаем OP_INTERNAL_TRANSFER в wallet получателя.
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
        assert(
            msgValue >= MIN_TON_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );
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
    // OP_REQUEST_CHANGE_POOL — запрос смены (timelock)
    // Только manager. Нельзя пока есть предыдущий запрос.
    // =====================================================
    if (op == OP_REQUEST_CHANGE_POOL) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );
        assert(
            !hasPending,
            ERROR_ALREADY_INITIALIZED
        );

        pendingAddress = msgBody.loadAddress();
        pendingTime = blockchain.now() + TIMELOCK_PERIOD;
        hasPending = true;
        saveData();

        return;
    }

    // =====================================================
    // OP_CONFIRM_CHANGE_POOL — подтверждение (после таймлока)
    // =====================================================
    if (op == OP_CONFIRM_CHANGE_POOL) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );

        assert(hasPending, ERROR_NO_PENDING);
        assert(
            blockchain.now() >= pendingTime,
            ERROR_TOO_EARLY
        );

        realGasPoolAddress = pendingAddress;
        hasPending = false;
        saveData();

        return;
    }

    // =====================================================
    // OP_CANCEL_CHANGE_POOL — отмена запроса
    // Только manager. Можно в любой момент (защита от кражи сида).
    // =====================================================
    if (op == OP_CANCEL_CHANGE_POOL) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
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
        managerAddress,
        realGasPoolAddress,
        hasPending
    );
}

get fun getWalletConfig(): (bool, address?) {
    loadData();

    if (!walletConfigReady) {
        return (false, null);
    }

    return (true, masterAddress);
}

get fun getPendingChange(): (bool, address?, int) {
    loadData();

    if (!hasPending) {
        return (false, null, 0);
    }

    return (true, pendingAddress, pendingTime);
}