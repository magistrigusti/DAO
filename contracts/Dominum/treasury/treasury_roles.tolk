import "treasury_storage.tolk";
import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

fun treasuryRequireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun treasuryRequireManager(senderAddress: address) {
    assert(senderAddress == treasuryManagerAddress, ERROR_NOT_MANAGER);
}

fun treasuryRequireWalletConfigured() {
    assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun treasuryRequireMasterConfigured() {
    assert(masterConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun treasuryInitWalletConfig(newWalletAddress: address) {
    assert(!walletConfigured, ERROR_ALREADY_INITIALIZED);
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(totalReceivedDom == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSentDom == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSentNanograms == 0, ERROR_ALREADY_INITIALIZED);
    jettonWalletAddress = newWalletAddress;
    walletConfigured = true;
    treasurySaveData();
}

fun treasuryIsAllowedTarget(candidate: address): bool {
    return
        (candidate == bankDaoAddress) |
        (candidate == bankDefiAddress) |
        (candidate == bankDominumAddress) |
        (candidate == gasPoolAddress);
}

fun treasuryIsExpectedTarget(
    targetKind: int,
    candidate: address
): bool {
    if (targetKind == TREASURY_TARGET_BANK_DAO) {
        return candidate == bankDaoAddress;
    }
    if (targetKind == TREASURY_TARGET_BANK_DEFI) {
        return candidate == bankDefiAddress;
    }
    if (targetKind == TREASURY_TARGET_BANK_DOMINUM) {
        return candidate == bankDominumAddress;
    }
    if (targetKind == TREASURY_TARGET_GAS_POOL) {
        return candidate == gasPoolAddress;
    }
    return false;
}

fun treasuryClearPendingRequest() {
    hasPending = false;
    pendingKind = PENDING_NONE;
    pendingTargetKind = 0;
    pendingOldAddress = null;
    pendingNewAddress = null;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun treasuryRequireDistinctTarget(
    candidate: address,
    replacedAddress: address
) {
    assert(candidate != ownerAddress, ERROR_WRONG_TARGET);
    assert(candidate != treasuryManagerAddress, ERROR_WRONG_TARGET);
    assert(candidate != jettonWalletAddress, ERROR_WRONG_TARGET);
    if (bankDaoAddress != replacedAddress) {
        assert(candidate != bankDaoAddress, ERROR_WRONG_TARGET);
    }
    if (bankDefiAddress != replacedAddress) {
        assert(candidate != bankDefiAddress, ERROR_WRONG_TARGET);
    }
    if (bankDominumAddress != replacedAddress) {
        assert(candidate != bankDominumAddress, ERROR_WRONG_TARGET);
    }
    if (gasPoolAddress != replacedAddress) {
        assert(candidate != gasPoolAddress, ERROR_WRONG_TARGET);
    }
}

fun treasuryRequestAddressChange(
    targetKind: int,
    oldAddress: address,
    newAddress: address
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(oldAddress != newAddress, ERROR_INVALID_AMOUNT);
    assert(
        treasuryIsExpectedTarget(targetKind, oldAddress),
        ERROR_WRONG_TARGET
    );
    treasuryRequireDistinctTarget(newAddress, oldAddress);
    hasPending = true;
    pendingKind = PENDING_ADDRESS;
    pendingTargetKind = targetKind;
    pendingOldAddress = oldAddress;
    pendingNewAddress = newAddress;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun treasuryRequestTaxChange(
    oldTaxMultiplier: int,
    newTaxMultiplier: int
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(oldTaxMultiplier == taxMultiplier, ERROR_INVALID_AMOUNT);
    assert(
        newTaxMultiplier >= MIN_TAX_MULTIPLIER,
        ERROR_INVALID_AMOUNT
    );
    assert(
        newTaxMultiplier <= MAX_TAX_MULTIPLIER,
        ERROR_LIMIT_EXCEEDED
    );
    hasPending = true;
    pendingKind = PENDING_TAX;
    pendingTargetKind = 0;
    pendingOldAddress = null;
    pendingNewAddress = null;
    pendingOldValue = oldTaxMultiplier;
    pendingNewValue = newTaxMultiplier;
}

fun treasuryApplyAddressChange(): bool {
    assert(pendingOldAddress != null, ERROR_NO_PENDING);
    assert(pendingNewAddress != null, ERROR_NO_PENDING);
    var oldAddress = pendingOldAddress!;
    var newAddress = pendingNewAddress!;
    treasuryRequireDistinctTarget(newAddress, oldAddress);
    if (pendingTargetKind == TREASURY_TARGET_BANK_DAO) {
        assert(oldAddress == bankDaoAddress, ERROR_NOT_IN_WHITELIST);
        bankDaoAddress = newAddress;
        return false;
    }
    if (pendingTargetKind == TREASURY_TARGET_BANK_DEFI) {
        assert(oldAddress == bankDefiAddress, ERROR_NOT_IN_WHITELIST);
        bankDefiAddress = newAddress;
        return false;
    }
    if (pendingTargetKind == TREASURY_TARGET_BANK_DOMINUM) {
        assert(oldAddress == bankDominumAddress, ERROR_NOT_IN_WHITELIST);
        bankDominumAddress = newAddress;
        return false;
    }
    if (pendingTargetKind == TREASURY_TARGET_GAS_POOL) {
        assert(oldAddress == gasPoolAddress, ERROR_NOT_IN_WHITELIST);
        gasPoolAddress = newAddress;
        return true;
    }
    throw(ERROR_WRONG_TARGET);
}

fun treasurySendTaxToGasPool(queryId: int) {
    var body = beginCell()
        .storeUint(OP_CHANGE_TAX, 32)
        .storeUint(queryId, 64)
        .storeUint(taxMultiplier, 16)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasuryHandleGovernance(
    op: int,
    senderAddress: address,
    queryId: int,
    msgBody: slice
): bool {
    if (op == OP_INIT_TREASURY_WALLET_CONFIG) {
        treasuryRequireOwner(senderAddress);
        treasuryInitWalletConfig(msgBody.loadAddress());
        return true;
    }
    if (op == OP_REPLACE_TREASURY_ADDRESS) {
        treasuryRequireManager(senderAddress);
        treasuryRequestAddressChange(
            msgBody.loadUint(8),
            msgBody.loadAddress(),
            msgBody.loadAddress()
        );
        treasurySaveData();
        return true;
    }
    if (op == OP_CHANGE_TAX) {
        treasuryRequireManager(senderAddress);
        treasuryRequestTaxChange(
            msgBody.loadUint(16),
            msgBody.loadUint(16)
        );
        treasurySaveData();
        return true;
    }
    if (op == OP_CONFIRM_TREASURY_REQUEST) {
        treasuryRequireOwner(senderAddress);
        assert(hasPending, ERROR_NO_PENDING);
        var notifyGasPool = false;
        if (pendingKind == PENDING_ADDRESS) {
            notifyGasPool = treasuryApplyAddressChange();
        }
        if (pendingKind == PENDING_TAX) {
            taxMultiplier = pendingNewValue;
            notifyGasPool = true;
        }
        treasuryClearPendingRequest();
        treasurySaveData();
        if (notifyGasPool) {
            treasurySendTaxToGasPool(queryId);
        }
        return true;
    }
    if (op == OP_CANCEL_TREASURY_REQUEST) {
        treasuryRequireOwner(senderAddress);
        assert(hasPending, ERROR_NO_PENDING);
        treasuryClearPendingRequest();
        treasurySaveData();
        return true;
    }
    return false;
}

fun treasuryAcceptNotification(
    senderAddress: address,
    msgBody: slice
) {
    treasuryRequireWalletConfigured();
    assert(senderAddress == jettonWalletAddress, ERROR_NOT_VALID_WALLET);
    var amount = msgBody.loadCoins();
    var fromAddress = msgBody.loadAddress();
    if (fromAddress == contract.getAddress()) {
        return;
    }
    assert(fromAddress == gasPoolAddress, ERROR_NOT_IN_WHITELIST);
    totalReceivedDom += amount;
    treasurySaveData();
}
