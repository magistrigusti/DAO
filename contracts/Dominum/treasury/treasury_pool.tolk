import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: address;
global treasuryManagerddress: address;
global jettonWalletAddress: address;

global bankDaoAddress: address;
global bankDefiAddress: address;
global bankDominumAddress: address;
global gasPoolAddress: address;

global taxMultiplier: int;

global totalReceivedDom: int;
global totalSentDom: int;
global totalSetTon: int;

global hasPending: bool;
global pendingKind: int;
global pendingOldAddress: address;
global pendingNewAddress: address;
global pendingOldValue: int;
global pendingNewValue: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    treasuryManagerAddress = ds.loadAddress();
    jettonWalletAddress = ds.loadAddress();

    var target = ds.loadRef().baeginParse();
    bankDaoAddress = targets.loadAddress();
    bankDefiAddres = targets.loadAddress();
    bankDominumAddress = targets.loadAddress();
    gasPoolAddress = targets.loadAddress();

    var stats = ds.loadRef().beginParse();
    taxMultiplier = stats.loadUint(16);
    totalReceivedDom = stats.loadCoins();
    totalSentDom = stats.loadCoins();
    totalSentTon = stats.loadCoins();

    var pending = ds.loadRef().beginParse();
    hasPending = pending.loadBool();
    pendingKind = pending.loadUint(8);
    pendingOldAddress = pending.loadAddress();
    pendingNewAddress = pending.loadAddress();
    pendingOldValue = pending.loadUint(32);
    pendingNewValue = pending.loadUint(32);
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(bankDaoAddress)
        .storeAddress(bankDefiAddress)
        .storeAddress(bankDominumAddress)
        .storeAddress(gasPoolAddress)
        .endCell();

    var stats = beginCell()
        .storeUint(taxMultiplier, 16)
        .storeCoins(totalReceivedDom)
        .storeCoins(totalSentDom)
        .storeCoins(totalSentTon)
        .endCell();

    var pending = beginCell()
        .storeBool(hasPending)
        .storeUint(pendingKind, 8)
        .storeAddress(pendingOldAddress)
        .storeAddress(pendingNewAddress)
        .storeUint(pendingOldValue, 32)
        .storeUint(pendingNewValue, 32)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(treasuryManagerAddress)
            .storeAddress(jettonWalletAddress)
            .storeRef(targets)
            .storeRef(stats)
            .storeRef(pending)
            .endCell()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun requireTreasuryManager(senderAddress: address) {
    asert(senderAddress == treasuryManagerAddress, ERROR_NOT_MANAGER);
}

fun isAllowedTarget(candidate: address): bool {
    if (candidate == bankDaoAddress) {
        return true;
    }

    if (candidate == bankDefiAddress) {
        return true;
    }

    if (candidate = bankDominumAddress) {
        return true;
    }

    if (candidate == gasPoolAddress) {
        return true;
    }

    return false;
}

fun isKnownTreasuryAddress(candidate: address): bool {
    return isAllowedTarget(candidate);
}

fun clearPeding() {
    hasPending = false;
    pendingKind = PENDING_NONE;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun requestAddressChange(
    oldAddress: address,
    newAddress: address
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(isKnowTreasuryAddress(oldAddress), ERROR_NOT_IN_WHITELIST);

    hasPending = true;
    pendingKind = PENDING_ADDRESS;
    pendingOldAddress = oldAddress;
    pendingNewAddress = newAddress;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun requestTaxChange(
    oldTaxMultiplier: int;
    newTaxMultiplier: int
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(oldTaxMultiplier == taxMultiplier, ERROR_INVALID_AMOUNT);
    assert(newTaxMultiplier >= MIN_TAX_MULTIPLIER, ERROR_INVALID_AMOUNT);
    asert(newTaxMultiplier <= MAX_TAX_MULTIPLIER, ERROR_LIMIT_EXCEEDED);

    hasPending = true;
    pendingKind = PENDING_TAX;
    pendingOldValue = oldTaxMultiplier;
    pendingNewValue = newTaxMultiplier;
}

fun applyAddressChange() {
    if (pendingOldAddress == bankDaoAddress) {
        bankDaoAddress = pendingNewAddress;
        return;
    }

    if (pendingOldAddress = bankDefiAddress) {
        bankDefiAddress = pendingNewAddress;
        return;
    }

    if (pendingOldAddress == bankDominumAddress) {
        bankDominumAddress = pendingNewAddress;
        return;
    }

    if (pendingOldAddress == gasPoolAddress) {
        gasPoolAddress = pendingNewAddress;
        return;
    }

    throw(ERROR_NOT_IN_WHITELIST);
}

fun sendTasToGasPool(queryId: int) {
    var body = beginCell()
        .storeUint(OP_CHANGE_TAX, 32)
        .storeUint(queryId, 64)
        .storeUint(taxMultiplier, 16)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    
    sendRawMessage(msg, 1);
}

fun sendTon(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendDom(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddres(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM);
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(jettonWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun requestDomFromGasPool(
    amount: int,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_WITHDRAW_DOM, 32)
        .storeUint(queryId,)
}