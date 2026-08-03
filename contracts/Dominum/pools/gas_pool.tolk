import "gas_pool_storage.tolk";
import "gas_pool_messages.tolk";
import "gas_pool_routes.tolk";
import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/gas-payments";

fun onBouncedMessage(in: InMessageBounced) {
    var msgBody = in.bouncedBody;
    msgBody.skipBouncedPrefix();
    gasPoolLoadData();
    assert(
        in.senderAddress == treasuryPoolAddress,
        ERROR_NOT_OWNER
    );
    var bouncedOp = msgBody.loadUint(32);
    var routeId = msgBody.loadUint(64);
    if (
        (bouncedOp == OP_GAS_POOL_READY) |
        (bouncedOp == OP_GAS_POOL_REJECT) |
        (bouncedOp == OP_GAS_POOL_COMMITTED)
    ) {
        return;
    }
}

fun gasPoolUpdateTax(msgBody: slice) {
    var newTaxMultiplier = msgBody.loadUint(16);
    assert(
        newTaxMultiplier >= MIN_TAX_MULTIPLIER,
        ERROR_INVALID_AMOUNT
    );
    assert(
        newTaxMultiplier <= MAX_TAX_MULTIPLIER,
        ERROR_LIMIT_EXCEEDED
    );
    taxMultiplier = newTaxMultiplier;
    gasPoolSaveData();
}

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;
    if (msgBody.isEmpty()) {
        return;
    }
    var senderAddress = in.senderAddress;
    gasPoolLoadData();
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_INIT_MASTER_CONFIG) {
        gasPoolRequireTreasury(senderAddress);
        gasPoolInitMasterConfig(
            msgBody.loadAddress(),
            msgBody.loadRef()
        );
        return;
    }
    if (op == OP_GAS_POOL_EXECUTE) {
        gasPoolRequireTreasury(senderAddress);
        setGasLimitToMaximum();
        gasPoolExecuteRoute(queryId, msgBody.loadCoins());
        return;
    }
    if (op == OP_GAS_POOL_COMMIT) {
        gasPoolRequireTreasury(senderAddress);
        gasPoolCommitRoute(queryId);
        return;
    }
    if (op == OP_PROTOCOL_FINALIZE) {
        gasPoolRequireTreasury(senderAddress);
        gasPoolFinalizeRoute(queryId);
        return;
    }
    if (op == OP_TRANSFER_NOTIFICATION) {
        gasPoolAcceptWalletNotification(senderAddress, msgBody);
        return;
    }
    if (op == OP_CHANGE_TAX) {
        gasPoolRequireTreasury(senderAddress);
        gasPoolUpdateTax(msgBody);
        return;
    }
    if (op == OP_TOP_UP) {
        gasPoolRequireTreasury(senderAddress);
        return;
    }
    if (op == OP_WITHDRAW_DOM) {
        gasPoolRequireTreasury(senderAddress);
        gasPoolRequireMasterConfigured();
        var amount = msgBody.loadCoins();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        gasPoolSendDomFromPoolWallet(amount, queryId);
        return;
    }
    throw(0xfff);
}

get fun getGasPoolData(): (
    address, address, bool, int, int, int, int, int
) {
    gasPoolLoadData();
    return (
        treasuryPoolAddress,
        masterAddress,
        masterConfigured,
        taxMultiplier,
        totalReceivedDom,
        totalSpentNanograms,
        totalExecuted,
        contract.getOriginalBalance()
    );
}

get fun getPoolWalletAddress(): address {
    gasPoolLoadData();
    return gasPoolWalletAddress(contract.getAddress());
}

get fun getWalletAddress(owner: address): address {
    gasPoolLoadData();
    return gasPoolWalletAddress(owner);
}

get fun getDomTransferFee(): int {
    gasPoolLoadData();
    return gasPoolCalculateFee();
}

get fun getGasPoolExecution(routeId: int): (int, int, bool) {
    gasPoolLoadData();
    return gasPoolReadExecution(routeId);
}
