import "treasury_storage.tolk";
import "treasury_roles.tolk";
import "treasury_messages.tolk";
import "treasury_routes.tolk";
import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
fun treasurySendStoredResult(routeId: int) {
    var (
        sourceWalletOpt, sourceQueryId, _, _, _, _,
        state, _, success, found
    ) = treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    assert(sourceWalletOpt != null, ERROR_NO_PENDING);
    assert(
        state == PROTOCOL_ROUTE_WAIT_SOURCE_ACK,
        ERROR_PROTOCOL_STATE
    );
    treasurySendSourceResult(
        routeId,
        sourceWalletOpt!,
        sourceQueryId,
        success
    );
}

fun treasuryRejectRoute(routeId: int) {
    treasurySetRouteState(
        routeId,
        PROTOCOL_ROUTE_WAIT_GAS,
        PROTOCOL_ROUTE_WAIT_SOURCE_ACK,
        false
    );
    treasurySendStoredResult(routeId);
}

fun treasuryAcceptGasCommit(routeId: int) {
    treasurySetRouteState(
        routeId,
        PROTOCOL_ROUTE_WAIT_COMMIT,
        PROTOCOL_ROUTE_WAIT_SOURCE_ACK,
        true
    );
    treasurySendStoredResult(routeId);
}

fun treasuryAcceptSourceAck(
    senderWallet: address,
    routeId: int,
    msgBody: slice
) {
    var receivedQueryId = msgBody.loadUint(64);
    var receivedSuccess = msgBody.loadBool();
    var (
        sourceWalletOpt, sourceQueryId, _, _, _, _,
        state, _, success, found
    ) = treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    assert(sourceWalletOpt != null, ERROR_NO_PENDING);
    assert(senderWallet == sourceWalletOpt!, ERROR_NOT_VALID_WALLET);
    assert(
        state == PROTOCOL_ROUTE_WAIT_SOURCE_ACK,
        ERROR_PROTOCOL_STATE
    );
    assert(receivedQueryId == sourceQueryId, ERROR_PROTOCOL_MISMATCH);
    assert(receivedSuccess == success, ERROR_PROTOCOL_MISMATCH);
    treasuryDeleteRoute(routeId);
    treasurySaveData();
    treasurySendFinalization(
        sourceWalletOpt!,
        routeId,
        sourceQueryId
    );
    treasurySendFinalization(
        gasPoolAddress,
        routeId,
        sourceQueryId
    );
}

fun treasuryRetryRoute(routeId: int) {
    var (
        _, _, _, _, _, fee, state, _, _, found
    ) = treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    if (state == PROTOCOL_ROUTE_WAIT_GAS) {
        treasurySendGasExecution(routeId, fee);
        return;
    }
    if (state == PROTOCOL_ROUTE_DELIVERING) {
        treasuryDeliverMissing(routeId);
        return;
    }
    if (state == PROTOCOL_ROUTE_WAIT_COMMIT) {
        treasurySendGasCommit(routeId);
        return;
    }
    if (state == PROTOCOL_ROUTE_WAIT_SOURCE_ACK) {
        treasurySendStoredResult(routeId);
        return;
    }
    throw(ERROR_PROTOCOL_STATE);
}

fun treasuryValidateDeliveryBounce(
    senderWallet: address,
    routeId: int,
    msgBody: slice
) {
    var leg = msgBody.loadUint(8);
    var (_, _, _, toOwnerOpt, _, _, state, _, _, found) =
        treasuryReadRoute(routeId);
    assert(found, ERROR_NO_PENDING);
    assert(toOwnerOpt != null, ERROR_NO_PENDING);
    assert(state == PROTOCOL_ROUTE_DELIVERING, ERROR_PROTOCOL_STATE);
    var legOwner = treasuryLegOwner(toOwnerOpt!, leg);
    assert(
        senderWallet == treasuryWalletAddress(legOwner),
        ERROR_NOT_VALID_WALLET
    );
}

fun onBouncedMessage(in: InMessageBounced) {
    var msgBody = in.bouncedBody;
    msgBody.skipBouncedPrefix();
    treasuryLoadData();
    var bouncedOp = msgBody.loadUint(32);
    var routeId = msgBody.loadUint(64);
    if (bouncedOp == OP_GAS_POOL_EXECUTE) {
        assert(in.senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        treasuryRejectRoute(routeId);
        return;
    }
    if (bouncedOp == OP_PROTOCOL_DELIVERY) {
        treasuryValidateDeliveryBounce(
            in.senderAddress,
            routeId,
            msgBody
        );
        return;
    }
    if (bouncedOp == OP_GAS_POOL_COMMIT) {
        assert(in.senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        return;
    }
    if (
        (bouncedOp == OP_TREASURY_SETTLE) |
        (bouncedOp == OP_TREASURY_FAILED)
    ) {
        var (sourceWalletOpt, _, _, _, _, _, _, _, _, found) =
            treasuryReadRoute(routeId);
        assert(found, ERROR_NO_PENDING);
        assert(sourceWalletOpt != null, ERROR_NO_PENDING);
        assert(
            in.senderAddress == sourceWalletOpt!,
            ERROR_NOT_VALID_WALLET
        );
    }
}

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;
    if (msgBody.isEmpty()) {
        return;
    }
    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;
    var myBalance = contract.getOriginalBalance();
    treasuryLoadData();
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    if (op == OP_TREASURY_EXECUTE) {
        treasuryStartExecution(senderAddress, queryId, msgBody);
        return;
    }
    if (op == OP_GAS_POOL_READY) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        treasuryDeliverMissing(queryId);
        return;
    }
    if (op == OP_GAS_POOL_REJECT) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        treasuryRejectRoute(queryId);
        return;
    }
    if (op == OP_PROTOCOL_DELIVERY_ACK) {
        treasuryAcceptDeliveryAck(senderAddress, queryId, msgBody);
        return;
    }
    if (op == OP_GAS_POOL_COMMITTED) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        treasuryAcceptGasCommit(queryId);
        return;
    }
    if (op == OP_PROTOCOL_SOURCE_ACK) {
        treasuryAcceptSourceAck(senderAddress, queryId, msgBody);
        return;
    }
    if (op == OP_PROTOCOL_RETRY) {
        assert(
            msgValue >= PROTOCOL_RETRY_MIN_GRAMS,
            ERROR_INSUFFICIENT_GAS
        );
        treasuryRetryRoute(queryId);
        return;
    }
    if (op == OP_INIT_MASTER_CONFIG) {
        treasuryRequireOwner(senderAddress);
        assert(
            msgValue >= MIN_GRAMS_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );
        treasuryInitMasterConfig(
            msgBody.loadAddress(),
            msgBody.loadRef(),
            queryId
        );
        return;
    }
    if (op == OP_TRANSFER_NOTIFICATION) {
        treasuryAcceptNotification(senderAddress, msgBody);
        return;
    }
    if (
        treasuryHandleGovernance(
            op,
            senderAddress,
            queryId,
            msgBody
        )
    ) {
        return;
    }
    if (
        treasuryHandleFinance(
            op,
            senderAddress,
            msgValue,
            myBalance,
            queryId,
            msgBody
        )
    ) {
        return;
    }
    throw(0xffff);
}

get fun getTreasuryPoolData(): (
    address, address, address, bool,
    address, address, address, address,
    int, int, int, int, int
) {
    treasuryLoadData();
    return (
        ownerAddress,
        treasuryManagerAddress,
        jettonWalletAddress,
        walletConfigured,
        bankDaoAddress,
        bankDefiAddress,
        bankDominumAddress,
        gasPoolAddress,
        taxMultiplier,
        totalReceivedDom,
        totalSentDom,
        totalSentNanograms,
        nextRouteId
    );
}

get fun getTreasuryPendingData(): (
    bool, int, int, address?, address?, int, int
) {
    treasuryLoadData();
    return (
        hasPending,
        pendingKind,
        pendingTargetKind,
        pendingOldAddress,
        pendingNewAddress,
        pendingOldValue,
        pendingNewValue
    );
}

get fun isTreasuryTargetAllowed(candidate: address): bool {
    treasuryLoadData();
    return treasuryIsAllowedTarget(candidate);
}

get fun getTreasuryRoute(
    routeId: int
): (
    address?, int, address?, address?, int,
    int, int, int, bool, bool
) {
    treasuryLoadData();
    return treasuryReadRoute(routeId);
}
