import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// BANK DOMINUM — главный банк экосистемы DOM.
// Управляет своим DOM-wallet и может пополнять gas_pool.
// Владелец зашит при деплое, не меняется.
// ========================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global ownerAddress: address;
global gasPoolAddress: address;
global domWalletAddress: address;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    domWalletAddress = ds.loadAddress();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(gasPoolAddress)
            .storeAddress(domWalletAddress)
            .endCell()
    );
}

// -----------------------------------------------------
// SERVICE
// -----------------------------------------------------
fun requireOwner(senderAddress: address) {
    assert(
        senderAddress == ownerAddress,
        ERROR_NOT_OWNER
    );
}

// -----------------------------------------------------
// ОТПРАВКА TON
// -----------------------------------------------------
fun sendTon(toAddress: address, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ВЫВОД DOM ЧЕРЕЗ СВОЙ WALLET
// -----------------------------------------------------
// Новый формат OP_TRANSFER v2:
// amount | toOwner | responseDestination | maxFeeDom
// -----------------------------------------------------
fun withdrawDomJettons(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var transferBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(ownerAddress)
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(domWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(transferBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ЗАПРОС В GAS POOL НА ВЫВОД НАКОПЛЕННЫХ DOM
// -----------------------------------------------------
// ВАЖНО: порядок тела для gas_pool:
// OP_WITHDRAW_DOM | queryId | amount | toOwner
// -----------------------------------------------------
fun withdrawFromGasPool(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_WITHDRAW_DOM, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ПОПОЛНЕНИЕ GAS POOL В TON
// -----------------------------------------------------
fun refillGasPool(tonAmount: int, queryId: int) {
    if (tonAmount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_TOP_UP, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(tonAmount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    // Пустое сообщение — просто принимаем TON
    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;
    var myBalance = contract.getOriginalBalance();

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // Только от своего jetton wallet.
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress == domWalletAddress,
            ERROR_NOT_VALID_WALLET
        );

        return;
    }

    // =====================================================
    // OP_WITHDRAW — вывести TON
    // body: amount | toAddress
    // =====================================================
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            amount + MIN_TON_FOR_STORAGE <= myBalance,
            ERROR_INSUFFICIENT_BALANCE
        );

        sendTon(toAddress, amount, queryId);
        return;
    }

    // =====================================================
    // OP_WITHDRAW_JETTONS — вывести DOM со своего wallet
    // body: amount | toAddress
    // =====================================================
    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            msgValue >= MIN_TON_FOR_TRANSFER,
            ERROR_INSUFFICIENT_GAS
        );

        withdrawDomJettons(toAddress, amount, queryId);
        return;
    }

    // =====================================================
    // OP_WITHDRAW_FROM_POOL — забрать DOM из gas_pool
    // body: toAddress | amount
    // =====================================================
    if (op == OP_WITHDRAW_FROM_POOL) {
        requireOwner(senderAddress);

        var toAddress = msgBody.loadAddress();
        var amount = msgBody.loadCoins();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            msgValue >= MIN_TON_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );

        withdrawFromGasPool(toAddress, amount, queryId);
        return;
    }

    // =====================================================
    // OP_REFILL_POOL — пополнить gas_pool TON-резервом
    // body: tonAmount
    // =====================================================
    if (op == OP_REFILL_POOL) {
        requireOwner(senderAddress);

        var tonAmount = msgBody.loadCoins();

        assert(tonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(
            msgValue >= tonAmount + MIN_TON_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );

        refillGasPool(tonAmount, queryId);
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getBankDominumData(): (
    address, address, address, int
) {
    loadData();

    return (
        ownerAddress,
        gasPoolAddress,
        domWalletAddress,
        contract.getOriginalBalance()
    );
}