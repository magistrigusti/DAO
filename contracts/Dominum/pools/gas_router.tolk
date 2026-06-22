import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// Стабильная точка входа для всех DOM Wallet.
// Адрес Router входит в StateInit кошелька и никогда не меняется.
// Меняется только activeGasPoolAddress внутри Router.

global controllerAddress: address;
global controllerConfigured: bool;
global activeGasPoolAddress: address;

fun loadData() {
    var ds = contract.getData().beginParse();

    controllerAddress = ds.loadAddress();
    controllerConfigured = ds.loadBool();
    activeGasPoolAddress = ds.loadAddress();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(controllerAddress)
            .storeBool(controllerConfigured)
            .storeAddress(activeGasPoolAddress)
            .endCell()
    );
}

fun requireController(senderAddress: address) {
    assert(senderAddress == controllerAddress, ERROR_NOT_OWNER);
}

fun forwardExecution(
    senderWalletAddress: address,
    msgBody: slice,
    queryId: int
) {
    var jettonAmount = msgBody.loadCoins();
    var toOwner = msgBody.loadAddress();
    var fromOwner = msgBody.loadAddress();
    var paidFeeDom = msgBody.loadCoins();

    var body = beginCell()
        .storeUint(OP_GAS_POOL_EXECUTE, 32)
        .storeUint(queryId, 64)
        .storeAddress(senderWalletAddress)
        .storeCoins(jettonAmount)
        .storeAddress(toOwner)
        .storeAddress(fromOwner)
        .storeCoins(paidFeeDom)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(activeGasPoolAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun forwardSettlement(
    walletAddress: address,
    success: bool,
    queryId: int
) {
    var settlementOp = OP_GAS_ROUTER_FAILED;

    if (success) {
        settlementOp = OP_EXCESSES;
    }

    var body = beginCell()
        .storeUint(settlementOp, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun forwardWalletDelivery(
    msgBody: slice
) {
    var walletAddress = msgBody.loadAddress();
    var walletStateInit = msgBody.loadRef();
    var walletBody = msgBody.loadRef();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(0)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(walletStateInit)
        .storeRef(walletBody)
        .endCell();

    sendRawMessage(msg, 64);
}

fun onBouncedMessage(in: InMessageBounced) {
    var msgBody = in.bouncedBody;
    msgBody.skipBouncedPrefix();

    var bouncedOp = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (bouncedOp == OP_GAS_POOL_EXECUTE) {
        var senderWalletAddress = msgBody.loadAddress();
        forwardSettlement(senderWalletAddress, false, queryId);
    }
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

    if (op == OP_GAS_ROUTER_SET_CONTROLLER) {
        requireController(senderAddress);
        assert(!controllerConfigured, ERROR_ALREADY_INITIALIZED);

        controllerAddress = msgBody.loadAddress();
        controllerConfigured = true;
        saveData();
        return;
    }

    if (op == OP_GAS_ROUTER_SET_POOL) {
        requireController(senderAddress);

        var newGasPoolAddress = msgBody.loadAddress();
        assert(newGasPoolAddress != activeGasPoolAddress, ERROR_INVALID_AMOUNT);

        activeGasPoolAddress = newGasPoolAddress;
        saveData();
        return;
    }

    if (op == OP_GAS_ROUTER_EXECUTE) {
        forwardExecution(senderAddress, msgBody, queryId);
        return;
    }

    if (op == OP_GAS_ROUTER_SETTLE) {
        assert(senderAddress == activeGasPoolAddress, ERROR_NOT_OWNER);

        var walletAddress = msgBody.loadAddress();
        var success = msgBody.loadBool();

        forwardSettlement(walletAddress, success, queryId);
        return;
    }

    if (op == OP_GAS_ROUTER_DELIVER) {
        assert(senderAddress == activeGasPoolAddress, ERROR_NOT_OWNER);
        forwardWalletDelivery(msgBody);
        return;
    }

    throw(0xffff);
}

get fun getGasRouterData(): (address, bool, address) {
    loadData();

    return (
        controllerAddress,
        controllerConfigured,
        activeGasPoolAddress
    );
}
