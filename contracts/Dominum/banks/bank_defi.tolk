import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// BANK DEFI — банк DeFi-ветки Dominum.
// ========================================
// Принимает DOM от Giver DeFi.
// Хранит DOM на своём jetton wallet.
// Отправляет DOM/TON только на 2 зашитых адреса:
//   - defiFoundationAddress
//   - marketMakerAddress
//
// Owner зашит при деплое, не меняется.
// Динамического whitelist нет.
// ========================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global ownerAddress: address;
global walletAddress: address;

global defiFoundationAddress: address;
global marketMakerAddress: address;

global totalReceived: int;
global totalSent: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();

    var targets = ds.loadRef().beginParse();
    defiFoundationAddress = targets.loadAddress();
    marketMakerAddress = targets.loadAddress();

    totalReceived = ds.loadCoins();
    totalSent = ds.loadCoins();
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(defiFoundationAddress)
        .storeAddress(marketMakerAddress)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(walletAddress)
            .storeRef(targets)
            .storeCoins(totalReceived)
            .storeCoins(totalSent)
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

fun isAllowedTarget(candidate: address): bool {
    if (candidate == defiFoundationAddress) {
        return true;
    }

    if (candidate == marketMakerAddress) {
        return true;
    }

    return false;
}

// -----------------------------------------------------
// ОТПРАВКА DOM ЧЕРЕЗ СВОЙ WALLET
// -----------------------------------------------------
// Новый формат OP_TRANSFER v2:
// amount | toOwner | responseDestination | maxFeeDom
// -----------------------------------------------------
fun sendDom(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ОТПРАВКА TON
// -----------------------------------------------------
fun sendTon(
    toAddress: address,
    amount: int,
    queryId: int
) {
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
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    if (in.isBounced) {
        return;
    }

    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // Только от своего jetton wallet.
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress == walletAddress,
            ERROR_NOT_VALID_WALLET
        );

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        // Рефанд от gas_pool после нашего вывода
        if (fromAddress == contract.getAddress()) {
            return;
        }

        totalReceived = totalReceived + amount;
        saveData();

        return;
    }

    // =====================================================
    // OP_WITHDRAW_JETTONS — вывести DOM (owner only)
    // body: amount | toAddress
    // Только на defiFoundationAddress или marketMakerAddress.
    // =====================================================
    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        totalSent = totalSent + amount;
        saveData();

        sendDom(toAddress, amount, queryId);
        return;
    }

    // =====================================================
    // OP_WITHDRAW — вывести TON (owner only)
    // body: amount | toAddress
    // Только на defiFoundationAddress или marketMakerAddress.
    // =====================================================
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendTon(toAddress, amount, queryId);
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getDefiBankData(): (
    address, address, address, address, int, int
) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        defiFoundationAddress,
        marketMakerAddress,
        totalReceived,
        totalSent
    );
}

get fun isAddressAllowed(candidate: address): bool {
    loadData();
    return isAllowedTarget(candidate);
}