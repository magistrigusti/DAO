import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// MARKET MAKER — резерв DeFi-ветки DOM.
// Принимает DOM, хранит ликвидность, выводит только owner.
// Для MVP это безопасная казна DeFi, без AMM-математики.
// ========================================

global ownerAddress: address;
global walletAddress: address;

global defiBankAddress: address;
global defiFoundationAddress: address;

global totalReceived: int;
global totalSent: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();

    var targets = ds.loadRef().beginParse();
    defiBankAddress = targets.loadAddress();
    defiFoundationAddress = targets.loadAddress();

    totalReceived = ds.loadCoins();
    totalSent = ds.loadCoins();
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(defiBankAddress)
        .storeAddress(defiFoundationAddress)
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

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun isAllowedTarget(candidate: address): bool {
    if (candidate == defiBankAddress) {
        return true;
    }

    if (candidate == defiFoundationAddress) {
        return true;
    }

    return false;
}

fun sendDom(toAddress: address, amount: int, queryId: int) {
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

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(senderAddress == walletAddress, ERROR_NOT_VALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        totalReceived = totalReceived + amount;
        saveData();

        return;
    }

    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);

        totalSent = totalSent + amount;
        saveData();

        sendDom(toAddress, amount, queryId);
        return;
    }

    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);

        sendTon(toAddress, amount, queryId);
        return;
    }

    throw(0xffff);
}

get fun getMarketData(): (
    address, address, address, address, int, int
) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        defiBankAddress,
        defiFoundationAddress,
        totalReceived,
        totalSent
    );
}

get fun isAddressAllowed(candidate: address): bool {
    loadData();
    return isAllowedTarget(candidate);
}