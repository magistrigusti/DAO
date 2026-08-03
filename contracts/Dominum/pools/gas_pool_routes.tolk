import "gas_pool_storage.tolk";
import "gas_pool_messages.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

fun gasPoolExecuteRoute(routeId: int, paidFeeDom: int) {
    assert(routeId > 0, ERROR_PROTOCOL_MISMATCH);
    assert(routeId <= PROTOCOL_ROUTE_MAX, ERROR_ROUTE_EXHAUSTED);
    var (savedFee, state, found) = gasPoolReadExecution(routeId);
    if (found) {
        assert(savedFee == paidFeeDom, ERROR_PROTOCOL_MISMATCH);
        if (state == PROTOCOL_EXECUTION_READY) {
            gasPoolSendReady(routeId);
            return;
        }
        assert(
            state == PROTOCOL_EXECUTION_COMMITTED,
            ERROR_PROTOCOL_STATE
        );
        gasPoolSendCommitted(routeId);
        return;
    }

    if (!masterConfigured) {
        gasPoolSendReject(routeId);
        return;
    }
    var expectedFee = gasPoolCalculateFee();
    if (paidFeeDom != expectedFee) {
        gasPoolSendReject(routeId);
        return;
    }
    var requiredBalance = PROTOCOL_GAS_BUDGET +
        MIN_GRAMS_FOR_STORAGE;
    if (contract.getOriginalBalance() < requiredBalance) {
        gasPoolSendReject(routeId);
        return;
    }
    gasPoolWriteExecution(
        routeId,
        expectedFee,
        PROTOCOL_EXECUTION_READY
    );
    totalSpentNanograms += PROTOCOL_GAS_BUDGET;
    gasPoolSaveData();
    gasPoolSendReady(routeId);
}

fun gasPoolCommitRoute(routeId: int) {
    var (fee, state, found) = gasPoolReadExecution(routeId);
    assert(found, ERROR_NO_PENDING);
    if (state == PROTOCOL_EXECUTION_READY) {
        gasPoolWriteExecution(
            routeId,
            fee,
            PROTOCOL_EXECUTION_COMMITTED
        );
        totalReceivedDom += fee;
        totalExecuted += 1;
        gasPoolSaveData();
        gasPoolSendCommitted(routeId);
        return;
    }
    assert(
        state == PROTOCOL_EXECUTION_COMMITTED,
        ERROR_PROTOCOL_STATE
    );
    gasPoolSendCommitted(routeId);
}

fun gasPoolFinalizeRoute(routeId: int) {
    var (_, _, found) = gasPoolReadExecution(routeId);
    if (!found) {
        return;
    }
    gasPoolDeleteExecution(routeId);
    gasPoolSaveData();
}

fun gasPoolAcceptWalletNotification(
    senderAddress: address,
    msgBody: slice
) {
    gasPoolRequireMasterConfigured();
    var poolWallet = gasPoolWalletAddress(contract.getAddress());
    assert(senderAddress == poolWallet, ERROR_NOT_VALID_WALLET);
    var amount = msgBody.loadCoins();
    var fromOwner = msgBody.loadAddress();
    assert(amount > 0, ERROR_INVALID_AMOUNT);
    assert(fromOwner != contract.getAddress(), ERROR_PROTOCOL_MISMATCH);
}
