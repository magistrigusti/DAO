import "wallet_storage.tolk";
import "wallet_addresses.tolk";
import "wallet_messages.tolk";
import "wallet_settlement.tolk";
import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

fun onBouncedMessage(in: InMessageBounced) {
    var msgBody = in.bouncedBody;
    msgBody.skipBouncedPrefix();
    walletLoadData();
    walletHandleBouncedMessage(in.senderAddress, msgBody);
}

fun walletHandleInternalTransfer(
    senderAddress: address,
    msgValue: int,
    queryId: int,
    msgBody: slice
) {
    var amount = msgBody.loadCoins();
    var fromOwner = msgBody.loadAddress();
    var responseDestination = msgBody.loadAddressOpt();
    var forwardGramsAmount = msgBody.loadCoins();
    var forwardPayload = msgBody;
    walletRequireInternalSender(senderAddress, fromOwner);
    assert(amount > 0, ERROR_INVALID_AMOUNT);
    balance += amount;
    walletSaveData();

    if (forwardGramsAmount > 0) {
        var excessAmount = msgValue - forwardGramsAmount -
            BASE_GRAMS_COST;
        walletSendTransferNotification(
            amount,
            fromOwner,
            queryId,
            forwardGramsAmount,
            forwardPayload
        );
        walletSendExcesses(
            responseDestination,
            excessAmount,
            queryId
        );
        return;
    }

    if (
        (senderAddress == masterAddress) |
        (senderAddress == treasuryPoolAddress)
    ) {
        walletSendProtocolNotification(amount, fromOwner, queryId);
        return;
    }
    walletSendExcesses(
        responseDestination,
        msgValue - BASE_GRAMS_COST,
        queryId
    );
}

fun walletHandleTransfer(
    senderAddress: address,
    msgValue: int,
    queryId: int,
    msgBody: slice
) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
    var jettonAmount = msgBody.loadCoins();
    var toOwner = msgBody.loadAddress();
    var responseDestination = msgBody.loadAddressOpt();
    var customPayload = msgBody.loadMaybeRef();
    var forwardGramsAmount = msgBody.loadCoins();
    var forwardPayload = msgBody;
    assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
    assert(balance >= jettonAmount, ERROR_INSUFFICIENT_BALANCE);
    assert(
        msgValue >= MIN_GRAMS_FOR_TRANSFER + forwardGramsAmount,
        ERROR_INSUFFICIENT_GAS
    );
    var toWallet = walletAddressForOwner(toOwner);
    var (_, pendingExists) = walletReadPendingTransfer(queryId);
    assert(!pendingExists, ERROR_ALREADY_INITIALIZED);
    walletSetPendingTransfer(
        queryId,
        jettonAmount,
        WALLET_PENDING_STANDARD,
        toWallet
    );
    balance -= jettonAmount;
    walletSaveData();
    walletSendStandardInternalTransfer(
        toOwner,
        jettonAmount,
        responseDestination,
        forwardGramsAmount,
        forwardPayload,
        queryId
    );
}

fun walletHandleProtocolTransfer(
    senderAddress: address,
    msgValue: int,
    queryId: int,
    msgBody: slice
) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
    var jettonAmount = msgBody.loadCoins();
    var toOwner = msgBody.loadAddress();
    var responseDestination = msgBody.loadAddressOpt();
    var paidFeeDom = msgBody.loadCoins();
    assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
    assert(paidFeeDom > 0, ERROR_INVALID_AMOUNT);
    assert(queryId > lastProtocolQueryId, ERROR_PROTOCOL_REPLAY);
    var totalSpend = jettonAmount + paidFeeDom;
    assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
    assert(msgValue >= MIN_GRAMS_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);
    var (_, pendingExists) = walletReadPendingTransfer(queryId);
    assert(!pendingExists, ERROR_ALREADY_INITIALIZED);
    walletSetPendingTransfer(
        queryId,
        totalSpend,
        WALLET_PENDING_PROTOCOL,
        treasuryPoolAddress
    );
    lastProtocolQueryId = queryId;
    balance -= totalSpend;
    walletSaveData();
    walletSendProtocolRequest(
        queryId,
        jettonAmount,
        toOwner,
        paidFeeDom
    );
}

fun walletHandleBurn(
    senderAddress: address,
    queryId: int,
    msgBody: slice
) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
    var burnAmount = msgBody.loadCoins();
    var responseDestination = msgBody.loadAddressOpt();
    var customPayload = msgBody.loadMaybeRef();
    assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
    assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);
    balance -= burnAmount;
    walletSaveData();
    walletSendBurnNotification(
        queryId,
        burnAmount,
        responseDestination
    );
}

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;
    if (msgBody.isEmpty()) {
        return;
    }
    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;
    walletLoadData();
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_TREASURY_SETTLE) {
        assert(
            senderAddress == treasuryPoolAddress,
            ERROR_NOT_VALID_WALLET
        );
        var sourceQueryId = msgBody.loadUint(64);
        walletHandleSourceResult(queryId, sourceQueryId, true);
        return;
    }
    if (op == OP_TREASURY_FAILED) {
        assert(
            senderAddress == treasuryPoolAddress,
            ERROR_NOT_VALID_WALLET
        );
        var sourceQueryId = msgBody.loadUint(64);
        walletHandleSourceResult(queryId, sourceQueryId, false);
        return;
    }
    if (op == OP_PROTOCOL_DELIVERY) {
        assert(
            senderAddress == treasuryPoolAddress,
            ERROR_NOT_VALID_WALLET
        );
        walletHandleProtocolDelivery(queryId, msgBody);
        return;
    }
    if (op == OP_PROTOCOL_FINALIZE) {
        assert(
            senderAddress == treasuryPoolAddress,
            ERROR_NOT_VALID_WALLET
        );
        var sourceQueryId = msgBody.loadUint(64);
        walletFinalizeSourceReceipt(queryId, sourceQueryId);
        return;
    }
    if (op == OP_CLEAR_PENDING_TRANSFER) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
        walletClearPendingStandardTransfer(queryId);
        return;
    }
    if (op == OP_INTERNAL_TRANSFER) {
        walletHandleInternalTransfer(
            senderAddress,
            msgValue,
            queryId,
            msgBody
        );
        return;
    }
    if (op == OP_TRANSFER) {
        walletHandleTransfer(
            senderAddress,
            msgValue,
            queryId,
            msgBody
        );
        return;
    }
    if (op == OP_PROTOCOL_TRANSFER) {
        walletHandleProtocolTransfer(
            senderAddress,
            msgValue,
            queryId,
            msgBody
        );
        return;
    }
    if (op == OP_BURN) {
        walletHandleBurn(senderAddress, queryId, msgBody);
        return;
    }
    throw(0xffff);
}

get fun get_wallet_data(): (int, address, address, cell) {
    walletLoadData();
    return (
        balance,
        ownerAddress,
        masterAddress,
        jettonWalletCode
    );
}

get fun get_protocol_data(): address {
    walletLoadData();
    return treasuryPoolAddress;
}

get fun getPendingTransfer(queryId: int): (int, bool) {
    walletLoadData();
    return walletReadPendingTransfer(queryId);
}

get fun getProtocolReplayData(): int {
    walletLoadData();
    return lastProtocolQueryId;
}

get fun getProcessedDelivery(
    routeId: int,
    leg: int
): (int, address?, bool) {
    walletLoadData();
    return walletReadDelivery(routeId, leg);
}

get fun getSourceReceipt(routeId: int): (int, bool, bool) {
    walletLoadData();
    return walletReadSourceReceipt(routeId);
}
