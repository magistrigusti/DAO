import "wallet_messages.tolk";
import "wallet_storage.tolk";
import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

fun walletSendDeliveryAck(
    routeId: int,
    leg: int,
    amount: int,
    fromOwner: address
) {
    var body = beginCell()
        .storeUint(OP_PROTOCOL_DELIVERY_ACK, 32)
        .storeUint(routeId, 64)
        .storeUint(leg, 8)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun walletSendSourceAck(
    routeId: int,
    sourceQueryId: int,
    success: bool
) {
    var body = beginCell()
        .storeUint(OP_PROTOCOL_SOURCE_ACK, 32)
        .storeUint(routeId, 64)
        .storeUint(sourceQueryId, 64)
        .storeBool(success)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun walletHandleProtocolDelivery(
    routeId: int,
    msgBody: slice
) {
    var leg = msgBody.loadUint(8);
    var amount = msgBody.loadCoins();
    var fromOwner = msgBody.loadAddress();
    assert(amount > 0, ERROR_INVALID_AMOUNT);
    var (savedAmount, savedOwnerOpt, found) =
        walletReadDelivery(routeId, leg);

    if (found) {
        assert(savedOwnerOpt != null, ERROR_PROTOCOL_MISMATCH);
        assert(savedAmount == amount, ERROR_PROTOCOL_MISMATCH);
        assert(savedOwnerOpt! == fromOwner, ERROR_PROTOCOL_MISMATCH);
        walletSendDeliveryAck(routeId, leg, amount, fromOwner);
        return;
    }

    balance += amount;
    walletStoreDelivery(routeId, leg, amount, fromOwner);
    walletSaveData();
    walletSendProtocolNotification(
        amount,
        fromOwner,
        routeId,
        MIN_GRAMS_FOR_STORAGE,
        1
    );
    walletSendDeliveryAck(routeId, leg, amount, fromOwner);
}

fun walletHandleSourceResult(
    routeId: int,
    sourceQueryId: int,
    success: bool
) {
    var (savedQueryId, savedSuccess, receiptFound) =
        walletReadSourceReceipt(routeId);
    if (receiptFound) {
        assert(savedQueryId == sourceQueryId, ERROR_PROTOCOL_MISMATCH);
        assert(savedSuccess == success, ERROR_PROTOCOL_MISMATCH);
        walletSendSourceAck(routeId, sourceQueryId, success);
        return;
    }

    var (totalSpend, pendingKind, _, pendingFound) =
        walletReadPendingTransferFull(sourceQueryId);
    assert(pendingFound, ERROR_NO_PENDING);
    assert(pendingKind == WALLET_PENDING_PROTOCOL, ERROR_WRONG_TARGET);
    if (!success) {
        balance += totalSpend;
    }
    walletDeletePendingTransfer(sourceQueryId);
    walletStoreSourceReceipt(routeId, sourceQueryId, success);
    walletSaveData();
    walletSendSourceAck(routeId, sourceQueryId, success);
}

fun walletFinalizeSourceReceipt(
    routeId: int,
    sourceQueryId: int
) {
    var (savedQueryId, _, found) = walletReadSourceReceipt(routeId);
    if (!found) {
        return;
    }
    assert(savedQueryId == sourceQueryId, ERROR_PROTOCOL_MISMATCH);
    walletDeleteSourceReceipt(routeId);
    walletSaveData();
}

fun walletRestoreUnroutedProtocol(queryId: int) {
    var (totalSpend, pendingKind, _, found) =
        walletReadPendingTransferFull(queryId);
    if (!found) {
        return;
    }
    assert(pendingKind == WALLET_PENDING_PROTOCOL, ERROR_WRONG_TARGET);
    balance += totalSpend;
    walletDeletePendingTransfer(queryId);
    walletSaveData();
}

fun walletHandleBouncedMessage(
    senderAddress: address,
    msgBody: slice
) {
    var bouncedOp = msgBody.loadUint(32);
    var bouncedQueryId = msgBody.loadUint(64);
    if (bouncedOp == OP_TREASURY_EXECUTE) {
        assert(
            senderAddress == treasuryPoolAddress,
            ERROR_NOT_VALID_WALLET
        );
        walletRestoreUnroutedProtocol(bouncedQueryId);
        return;
    }
    if (bouncedOp == OP_INTERNAL_TRANSFER) {
        var bouncedAmount = msgBody.loadCoins();
        walletRestoreStandardTransfer(
            bouncedQueryId,
            bouncedAmount,
            senderAddress
        );
        return;
    }
    if (bouncedOp == OP_BURN_NOTIFICATION) {
        assert(senderAddress == masterAddress, ERROR_NOT_MASTER);
        var burnAmount = msgBody.loadCoins();
        if (burnAmount > 0) {
            balance += burnAmount;
            walletSaveData();
        }
    }
}
