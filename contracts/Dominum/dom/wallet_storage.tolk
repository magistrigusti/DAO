import "../core/constants.tolk";
import "../core/errors.tolk";
import "@stdlib/tvm-dicts";

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global treasuryPoolAddress: address;
global jettonWalletCode: cell;
global pendingTransfers: dict;
global lastProtocolQueryId: int;
global processedDeliveries: dict;
global sourceReceipts: dict;

fun walletLoadData() {
    var ds = contract.getData().beginParse();
    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    treasuryPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
    pendingTransfers = createEmptyDict();
    lastProtocolQueryId = 0;
    processedDeliveries = createEmptyDict();
    sourceReceipts = createEmptyDict();

    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();
    if ((bitsLeft > 0) | (refsLeft > 0)) {
        pendingTransfers = ds.loadDict();
    }

    (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();
    if (refsLeft > 0) {
        var protocol = ds.loadRef().beginParse();
        lastProtocolQueryId = protocol.loadUint(64);
        processedDeliveries = protocol.loadDict();
        sourceReceipts = protocol.loadDict();
    }
}

fun walletSaveData() {
    var protocol = beginCell()
        .storeUint(lastProtocolQueryId, 64)
        .storeDict(processedDeliveries)
        .storeDict(sourceReceipts)
        .endCell();

    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(treasuryPoolAddress)
            .storeRef(jettonWalletCode)
            .storeDict(pendingTransfers)
            .storeRef(protocol)
            .endCell()
    );
}

fun walletSetPendingTransfer(
    queryId: int,
    totalSpend: int,
    pendingKind: int,
    expectedSender: address
) {
    var value = beginCell()
        .storeCoins(totalSpend)
        .storeUint(pendingKind, 8)
        .storeAddress(expectedSender)
        .endCell()
        .beginParse();
    pendingTransfers.uDictSet(64, queryId, value);
}

fun walletReadPendingTransfer(
    queryId: int
): (int, bool) {
    var (value, found) = pendingTransfers.uDictGet(64, queryId);
    if (!found) {
        return (0, false);
    }
    var valueSlice = value!;
    return (valueSlice.loadCoins(), true);
}

fun walletReadPendingTransferFull(
    queryId: int
): (int, int, address?, bool) {
    var (value, found) = pendingTransfers.uDictGet(64, queryId);
    if (!found) {
        return (0, 0, null, false);
    }
    var valueSlice = value!;
    var totalSpend = valueSlice.loadCoins();
    var (bitsLeft, _) = valueSlice.remainingBitsAndRefsCount();
    if (bitsLeft == 0) {
        return (
            totalSpend,
            WALLET_PENDING_PROTOCOL,
            treasuryPoolAddress,
            true
        );
    }
    var pendingKind = valueSlice.loadUint(8);
    var expectedSender = valueSlice.loadAddress();
    return (totalSpend, pendingKind, expectedSender, true);
}

fun walletDeletePendingTransfer(queryId: int) {
    pendingTransfers.uDictDelete(64, queryId);
}

fun walletRestoreStandardTransfer(
    queryId: int,
    bouncedAmount: int,
    bouncedSender: address
) {
    var (totalSpend, pendingKind, expectedSenderOpt, found) =
        walletReadPendingTransferFull(queryId);
    if (!found) {
        return;
    }
    assert(pendingKind == WALLET_PENDING_STANDARD, ERROR_WRONG_TARGET);
    assert(expectedSenderOpt != null, ERROR_NO_PENDING);
    assert(bouncedSender == expectedSenderOpt!, ERROR_NOT_VALID_WALLET);
    assert(bouncedAmount == totalSpend, ERROR_INVALID_AMOUNT);
    balance += totalSpend;
    walletDeletePendingTransfer(queryId);
    walletSaveData();
}

fun walletClearPendingStandardTransfer(queryId: int) {
    var (_, pendingKind, _, found) =
        walletReadPendingTransferFull(queryId);
    assert(found, ERROR_NO_PENDING);
    assert(pendingKind == WALLET_PENDING_STANDARD, ERROR_WRONG_TARGET);
    walletDeletePendingTransfer(queryId);
    walletSaveData();
}

fun walletDeliveryKey(routeId: int, leg: int): int {
    assert(routeId > 0, ERROR_PROTOCOL_MISMATCH);
    assert(routeId <= PROTOCOL_ROUTE_MAX, ERROR_ROUTE_EXHAUSTED);
    assert(
        (leg == PROTOCOL_LEG_RECIPIENT) |
        (leg == PROTOCOL_LEG_FEE),
        ERROR_PROTOCOL_MISMATCH
    );
    return routeId * 2 + leg;
}

fun walletReadDelivery(
    routeId: int,
    leg: int
): (int, address?, bool) {
    var key = walletDeliveryKey(routeId, leg);
    var (value, found) = processedDeliveries.uDictGet(64, key);
    if (!found) {
        return (0, null, false);
    }
    var valueSlice = value!;
    var amount = valueSlice.loadCoins();
    var fromOwner = valueSlice.loadAddress();
    return (amount, fromOwner, true);
}

fun walletStoreDelivery(
    routeId: int,
    leg: int,
    amount: int,
    fromOwner: address
) {
    var key = walletDeliveryKey(routeId, leg);
    var value = beginCell()
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell()
        .beginParse();
    processedDeliveries.uDictSet(64, key, value);
}

fun walletReadSourceReceipt(
    routeId: int
): (int, bool, bool) {
    var (value, found) = sourceReceipts.uDictGet(64, routeId);
    if (!found) {
        return (0, false, false);
    }
    var valueSlice = value!;
    var queryId = valueSlice.loadUint(64);
    var success = valueSlice.loadBool();
    return (queryId, success, true);
}

fun walletStoreSourceReceipt(
    routeId: int,
    queryId: int,
    success: bool
) {
    var value = beginCell()
        .storeUint(queryId, 64)
        .storeBool(success)
        .endCell()
        .beginParse();
    sourceReceipts.uDictSet(64, routeId, value);
}

fun walletDeleteSourceReceipt(routeId: int) {
    sourceReceipts.uDictDelete(64, routeId);
}
