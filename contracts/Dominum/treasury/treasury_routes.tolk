import "treasury_storage.tolk";
import "treasury_roles.tolk";
import "treasury_messages.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

fun treasuryWriteRoute(
    routeId: int,
    sourceWallet: address,
    sourceQueryId: int,
    fromOwner: address,
    toOwner: address,
    amount: int,
    fee: int,
    state: int,
    ackMask: int,
    success: bool
) {
    var details = beginCell()
        .storeAddress(fromOwner)
        .storeAddress(toOwner)
        .storeCoins(amount)
        .storeCoins(fee)
        .endCell();
    var route = beginCell()
        .storeAddress(sourceWallet)
        .storeUint(sourceQueryId, 64)
        .storeUint(state, 8)
        .storeUint(ackMask, 8)
        .storeBool(success)
        .storeRef(details)
        .endCell()
        .beginParse();
    pendingRoutes.uDictSet(64, routeId, route);
}

fun treasuryCreateRoute(
    sourceWallet: address,
    sourceQueryId: int,
    fromOwner: address,
    toOwner: address,
    amount: int,
    fee: int
): int {
    assert(nextRouteId > 0, ERROR_ROUTE_EXHAUSTED);
    assert(nextRouteId <= PROTOCOL_ROUTE_MAX, ERROR_ROUTE_EXHAUSTED);
    var routeId = nextRouteId;
    nextRouteId += 1;
    treasuryWriteRoute(
        routeId,
        sourceWallet,
        sourceQueryId,
        fromOwner,
        toOwner,
        amount,
        fee,
        PROTOCOL_ROUTE_WAIT_GAS,
        0,
        false
    );
    return routeId;
}

fun treasuryReadRoute(
    routeId: int
): (
    address?, int, address?, address?, int,
    int, int, int, bool, bool
) {
    var (route, found) = pendingRoutes.uDictGet(64, routeId);
    if (!found) {
        return (
            null, 0, null, null, 0,
            0, 0, 0, false, false
        );
    }
    var routeSlice = route!;
    var sourceWallet = routeSlice.loadAddress();
    var sourceQueryId = routeSlice.loadUint(64);
    var state = routeSlice.loadUint(8);
    var ackMask = routeSlice.loadUint(8);
    var success = routeSlice.loadBool();
    var details = routeSlice.loadRef().beginParse();
    var fromOwner = details.loadAddress();
    var toOwner = details.loadAddress();
    var amount = details.loadCoins();
    var fee = details.loadCoins();
    return (
        sourceWallet,
        sourceQueryId,
        fromOwner,
        toOwner,
        amount,
        fee,
        state,
        ackMask,
        success,
        true
    );
}

fun treasuryDeleteRoute(routeId: int) {
    pendingRoutes.uDictDelete(64, routeId);
}

fun treasuryLegOwner(
    toOwner: address,
    leg: int
): address {
    if (leg == PROTOCOL_LEG_RECIPIENT) {
        return toOwner;
    }
    assert(leg == PROTOCOL_LEG_FEE, ERROR_PROTOCOL_MISMATCH);
    return gasPoolAddress;
}

fun treasuryLegAmount(
    amount: int,
    fee: int,
    leg: int
): int {
    if (leg == PROTOCOL_LEG_RECIPIENT) {
        return amount;
    }
    assert(leg == PROTOCOL_LEG_FEE, ERROR_PROTOCOL_MISMATCH);
    return fee;
}

fun treasuryLegAckBit(leg: int): int {
    if (leg == PROTOCOL_LEG_RECIPIENT) {
        return PROTOCOL_ACK_RECIPIENT;
    }
    assert(leg == PROTOCOL_LEG_FEE, ERROR_PROTOCOL_MISMATCH);
    return PROTOCOL_ACK_FEE;
}

fun treasuryStartExecution(
    senderWallet: address,
    sourceQueryId: int,
    msgBody: slice
) {
    treasuryRequireMasterConfigured();
    var amount = msgBody.loadCoins();
    var toOwner = msgBody.loadAddress();
    var fromOwner = msgBody.loadAddress();
    var fee = msgBody.loadCoins();
    assert(amount > 0, ERROR_INVALID_AMOUNT);
    assert(fee > 0, ERROR_INVALID_AMOUNT);
    assert(
        senderWallet == treasuryWalletAddress(fromOwner),
        ERROR_NOT_VALID_WALLET
    );
    var routeId = treasuryCreateRoute(
        senderWallet,
        sourceQueryId,
        fromOwner,
        toOwner,
        amount,
        fee
    );
    treasurySaveData();
    treasurySendGasExecution(routeId, fee);
}

fun treasuryDeliverMissing(routeId: int) {
    var (
        sourceWalletOpt, sourceQueryId, fromOwnerOpt,
        toOwnerOpt, amount, fee, state, ackMask,
        success, found
    ) = treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    assert(sourceWalletOpt != null, ERROR_NO_PENDING);
    assert(fromOwnerOpt != null, ERROR_NO_PENDING);
    assert(toOwnerOpt != null, ERROR_NO_PENDING);
    assert(
        (state == PROTOCOL_ROUTE_WAIT_GAS) |
        (state == PROTOCOL_ROUTE_DELIVERING),
        ERROR_PROTOCOL_STATE
    );
    var sourceWallet = sourceWalletOpt!;
    var fromOwner = fromOwnerOpt!;
    var toOwner = toOwnerOpt!;
    treasuryWriteRoute(
        routeId,
        sourceWallet,
        sourceQueryId,
        fromOwner,
        toOwner,
        amount,
        fee,
        PROTOCOL_ROUTE_DELIVERING,
        ackMask,
        success
    );
    treasurySaveData();
    if ((ackMask & PROTOCOL_ACK_RECIPIENT) == 0) {
        treasurySendWalletDelivery(
            routeId,
            PROTOCOL_LEG_RECIPIENT,
            toOwner,
            amount,
            fromOwner
        );
    }
    if ((ackMask & PROTOCOL_ACK_FEE) == 0) {
        treasurySendWalletDelivery(
            routeId,
            PROTOCOL_LEG_FEE,
            gasPoolAddress,
            fee,
            fromOwner
        );
    }
}

fun treasuryAcceptDeliveryAck(
    senderWallet: address,
    routeId: int,
    msgBody: slice
) {
    var leg = msgBody.loadUint(8);
    var deliveredAmount = msgBody.loadCoins();
    var deliveredFromOwner = msgBody.loadAddress();
    var (
        sourceWalletOpt, sourceQueryId, fromOwnerOpt,
        toOwnerOpt, amount, fee, state, ackMask,
        success, found
    ) = treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    assert(sourceWalletOpt != null, ERROR_NO_PENDING);
    assert(fromOwnerOpt != null, ERROR_NO_PENDING);
    assert(toOwnerOpt != null, ERROR_NO_PENDING);
    assert(state == PROTOCOL_ROUTE_DELIVERING, ERROR_PROTOCOL_STATE);
    var fromOwner = fromOwnerOpt!;
    var toOwner = toOwnerOpt!;
    var legOwner = treasuryLegOwner(toOwner, leg);
    var expectedWallet = treasuryWalletAddress(legOwner);
    var expectedAmount = treasuryLegAmount(amount, fee, leg);
    assert(senderWallet == expectedWallet, ERROR_NOT_VALID_WALLET);
    assert(deliveredAmount == expectedAmount, ERROR_PROTOCOL_MISMATCH);
    assert(deliveredFromOwner == fromOwner, ERROR_PROTOCOL_MISMATCH);
    ackMask = ackMask | treasuryLegAckBit(leg);
    var nextState = PROTOCOL_ROUTE_DELIVERING;
    if (ackMask == PROTOCOL_ACK_ALL) {
        nextState = PROTOCOL_ROUTE_WAIT_COMMIT;
    }
    treasuryWriteRoute(
        routeId,
        sourceWalletOpt!,
        sourceQueryId,
        fromOwner,
        toOwner,
        amount,
        fee,
        nextState,
        ackMask,
        success
    );
    treasurySaveData();
    if (nextState == PROTOCOL_ROUTE_WAIT_COMMIT) {
        treasurySendGasCommit(routeId);
    }
}

fun treasurySetRouteState(
    routeId: int,
    expectedState: int,
    nextState: int,
    success: bool
) {
    var (
        sourceWalletOpt, sourceQueryId, fromOwnerOpt,
        toOwnerOpt, amount, fee, state, ackMask,
        _, found
    ) = treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    assert(sourceWalletOpt != null, ERROR_NO_PENDING);
    assert(fromOwnerOpt != null, ERROR_NO_PENDING);
    assert(toOwnerOpt != null, ERROR_NO_PENDING);
    assert(state == expectedState, ERROR_PROTOCOL_STATE);
    treasuryWriteRoute(
        routeId,
        sourceWalletOpt!,
        sourceQueryId,
        fromOwnerOpt!,
        toOwnerOpt!,
        amount,
        fee,
        nextState,
        ackMask,
        success
    );
    treasurySaveData();
}
