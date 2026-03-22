import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

// =====================================================
// JETTON WALLET — кошелёк DOM (TEP-74)
// =====================================================
// При transfer отправляет ОДНО сообщение на Gas Pool.
// Gas Pool сам распределяет: получателю + DOM Treasury.
// Пользователь прикладывает TON для запуска цепочки transfer.
// Wallet оставляет себе gas, а остаток форвардит в Gas Pool.
// =====================================================

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;
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
// WALLET ADDRESS
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
    return address.fromWorkchainAndHash(wc, stateInit.hash());
}

// -----------------------------------------------------
// ВАЛИДАЦИЯ ВНУТРЕННЕГО ОТПРАВИТЕЛЯ
// -----------------------------------------------------

fun requireInternalSender(
    senderAddress: address,
    fromOwner: address
) {
    // От Master — всегда ок (mint)
    if (senderAddress == masterAddress) {
        return;
    }

    // От Gas Pool — всегда ок (он делает transfers)
    if (senderAddress == gasPoolAddress) {
        return;
    }

    // Иначе — проверяем что это wallet отправителя
    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );

    assert(
        senderAddress == expectedWallet,
        ERROR_NOT_VALID_WALLET
    );
}

// -----------------------------------------------------
// NOTIFY OWNER (transfer_notification)
// -----------------------------------------------------

fun notifyOwner(amount: int, fromOwner: address, queryId: int) {
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
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_INTERNAL_TRANSFER — получили токены
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
    // OP_TRANSFER — отправка токенов (только owner)
    // Одно сообщение на Gas Pool!
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        // Фиксированная модель без курса:
        // комиссии всегда равны константам.
        var treasuryFee: int = TAX_AMOUNT;
        var gasPoolFee: int = TAX_HALF;

        var totalFee = treasuryFee + gasPoolFee;
        var totalSpend = jettonAmount + totalFee;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);

        balance -= totalSpend;
        saveData();

        // =====================================================
        // ОДНО СООБЩЕНИЕ НА GAS POOL
        // Передаём: сумму, получателя, налог, комиссию
        // Gas Pool сделает 2 сообщения из СВОЕГО TON
        // =====================================================
        var gasPoolBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(toOwner)
            .storeAddress(ownerAddress)
            .storeCoins(treasuryFee)
            .storeCoins(gasPoolFee)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(gasPoolAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(gasPoolBody)
            .endCell();

        sendRawMessage(msg, 64);

        return;
    }

    // =====================================================
    // OP_BURN — сжечь токены (только owner)
    // =====================================================
    if (op == OP_BURN) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadAddressOpt();

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

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
            .storeCoins(msgValue)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 1);

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getWalletData(): (int, address, address, address) {
    loadData();

    return (
        balance,
        ownerAddress,
        masterAddress,
        gasPoolAddress
    );
}