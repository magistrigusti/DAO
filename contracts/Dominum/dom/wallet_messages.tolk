import "wallet_addresses.tolk";
import "wallet_storage.tolk";
import "../core/op_codes.tolk";
import "../core/constants.tolk";

fun walletSendTransferNotification(
    amount: int,
    fromOwner: address,
    queryId: int,
    forwardGramsAmount: int,
    forwardPayload: slice
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeSlice(forwardPayload)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(ownerAddress)
        .storeCoins(forwardGramsAmount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun walletSendProtocolNotification(
    amount: int,
    fromOwner: address,
    routeId: int,
    value: int,
    sendMode: int
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(routeId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeBool(false)
        .endCell();
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(ownerAddress)
        .storeCoins(value)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, sendMode);
}

fun walletSendExcesses(
    responseDestination: address?,
    amount: int,
    queryId: int
) {
    if ((responseDestination == null) | (amount <= 0)) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(responseDestination!)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun walletSendStandardInternalTransfer(
    toOwner: address,
    amount: int,
    responseDestination: address?,
    forwardGramsAmount: int,
    forwardPayload: slice,
    queryId: int
) {
    var stateInit = walletBuildStateInit(toOwner);
    var toWallet = walletBuildAddress(stateInit);
    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(ownerAddress)
        .storeAddressOpt(responseDestination)
        .storeCoins(forwardGramsAmount)
        .storeSlice(forwardPayload)
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

fun walletSendProtocolRequest(
    queryId: int,
    jettonAmount: int,
    toOwner: address,
    paidFeeDom: int
) {
    var body = beginCell()
        .storeUint(OP_TREASURY_EXECUTE, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(toOwner)
        .storeAddress(ownerAddress)
        .storeCoins(paidFeeDom)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 64);
}

fun walletSendBurnNotification(
    queryId: int,
    burnAmount: int,
    responseDestination: address?
) {
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
}
