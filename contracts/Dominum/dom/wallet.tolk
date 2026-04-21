import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// DOM WALLET v2:
// - OP_TRANSFER body: amount | toOwner | responseDest | maxFeeDom
// - Юзер указывает maxFeeDom — сколько DOM готов отдать
//   как комиссию (излишек вернётся рефандом из gas_pool)
// - Wallet снимает (amount + maxFeeDom) с баланса и
//   отправляет ОДНО сообщение в gas_pool через proxy
// - Если gas_pool отскочит (bounce) — восстанавливаем баланс
// ========================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;  // = адрес proxy
global jettonWalletCode: cell;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------
fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(gasPoolAddress)
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
// ВАЛИДАЦИЯ ВНУТРЕННЕГО ОТПРАВИТЕЛЯ
// -----------------------------------------------------
fun requireInternalSender(
    senderAddress: address,
    fromOwner: address
) {
    // От Master — всегда ок (mint через Giver'ов)
    if (senderAddress == masterAddress) {
        return;
    }

    // От Proxy (gasPoolAddress) — всегда ок (transfer от других)
    if (senderAddress == gasPoolAddress) {
        return;
    }

    // Иначе — проверяем что sender = wallet отправителя
    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );

    assert(
        senderAddress == expectedWallet,
        ERROR_NOT_VALID_WALLET
    );
}

// -----------------------------------------------------
// УВЕДОМЛЕНИЕ OWNER (transfer_notification)
// -----------------------------------------------------
fun notifyOwner(
    amount: int,
    fromOwner: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

// -----------------------------------------------------
// ОБРАБОТКА ОТСКОКА (BOUNCE)
// -----------------------------------------------------
// Если сообщение в gas_pool отскочило — возвращаем
// юзеру списанный с баланса DOM (amount).
// maxFeeDom полностью восстановить из truncated bounce
// body нельзя (в bounce входит только 256 бит), но
// в нашей архитектуре proxy валидирует всё ДО gas_pool,
// так что отскоки по maxFeeDom маловероятны.
// -----------------------------------------------------
fun handleBouncedMessage(msgBody: slice) {
    // Пропускаем префикс 0xffffffff который маркирует bounce
    msgBody.loadUint(32);

    var op = msgBody.loadUint(32);
    msgBody.loadUint(64);  // queryId

    if (op == OP_GAS_POOL_EXECUTE) {
        var amount = msgBody.loadCoins();

        // Защитная проверка — вдруг bounce body битый
        if (amount > 0) {
            loadData();
            balance += amount;
            saveData();
        }
    }
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    // Обработка отскока от gas_pool / proxy
    if (in.isBounced) {
        handleBouncedMessage(msgBody);
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_INTERNAL_TRANSFER — получили DOM
    // body: amount | fromOwner | responseDest (опц)
    // =====================================================
    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();

        requireInternalSender(senderAddress, fromOwner);

        balance += amount;
        saveData();

        notifyOwner(amount, fromOwner, queryId);
        return;
    }

    // =====================================================
    // OP_TRANSFER v2 — юзер отправляет DOM
    // body: amount | toOwner | responseDest | maxFeeDom
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var maxFeeDom = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(maxFeeDom > 0, ERROR_INVALID_AMOUNT);

        var totalSpend = jettonAmount + maxFeeDom;

        assert(
            balance >= totalSpend,
            ERROR_INSUFFICIENT_BALANCE
        );

        assert(
            msgValue >= MIN_TON_FOR_TRANSFER,
            ERROR_INSUFFICIENT_GAS
        );

        balance -= totalSpend;
        saveData();

        // ОДНО сообщение в gas_pool через proxy.
        // Proxy валидирует sender, форвардит в realGasPool.
        // gas_pool считает комиссию и рассылает DOM.
        var gasPoolBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(toOwner)
            .storeAddress(ownerAddress)
            .storeCoins(maxFeeDom)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(gasPoolAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(gasPoolBody)
            .endCell();

        // mode 64 — carry весь входящий TON в gas_pool
        sendRawMessage(msg, 64);
        return;
    }

    // =====================================================
    // OP_BURN — сжечь DOM (только owner)
    // =====================================================
    if (op == OP_BURN) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadAddressOpt();

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(
            balance >= burnAmount,
            ERROR_INSUFFICIENT_BALANCE
        );

        balance -= burnAmount;
        saveData();

        var body = beginCell()
            .storeUint(OP_BURN_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(burnAmount)
            .storeAddress(ownerAddress)
            .storeAddressOpt(responseDestination)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(masterAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 64);
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getWalletData(): (
    int, address, address, address
) {
    loadData();

    return (
        balance,
        ownerAddress,
        masterAddress,
        gasPoolAddress
    );
}