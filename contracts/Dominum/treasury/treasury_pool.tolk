import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// TREASURY POOL — казна налогов DOM.
// =====================================================
// Хранит DOM и TON.
// Принимает DOM-налог только от активного GasPool.
// Выводит DOM/TON только в банки или в GasPool.
// TreasuryManager не меняет state напрямую: он отправляет распоряжение.
// Owner TreasuryPool подтверждает или отменяет распоряжение.
// =====================================================

global ownerAddress: address;
global treasuryManagerAddress: address;
global jettonWalletAddress: address;

global bankDaoAddress: address;
global bankDefiAddress: address;
global bankDominumAddress: address;
global gasPoolAddress: address;

global taxMultiplier: int;

global totalReceivedDom: int;
global totalSentDom: int;
global totalSentTon: int;

global hasPending: bool;
global pendingKind: int;
global pendingOldAddress: address?;
global pendingNewAddress: address?;
global pendingOldValue: int;
global pendingNewValue: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    treasuryManagerAddress = ds.loadAddress();
    jettonWalletAddress = ds.loadAddress();

    var targets = ds.loadRef().beginParse();
    bankDaoAddress = targets.loadAddress();
    bankDefiAddress = targets.loadAddress();
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
    pendingOldAddress = pending.loadAddressOpt();
    pendingNewAddress = pending.loadAddressOpt();
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
        .storeAddressOpt(pendingOldAddress)
        .storeAddressOpt(pendingNewAddress)
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
    assert(senderAddress == treasuryManagerAddress, ERROR_NOT_MANAGER);
}

fun isAllowedTarget(candidate: address): bool {
    if (candidate == bankDaoAddress) {
        return true;
    }

    if (candidate == bankDefiAddress) {
        return true;
    }

    if (candidate == bankDominumAddress) {
        return true;
    }

    if (candidate == gasPoolAddress) {
        return true;
    }

    return false;
}

fun clearPending() {
    hasPending = false;
    pendingKind = PENDING_NONE;
    pendingOldAddress = null;
    pendingNewAddress = null;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun requestAddressChange(
    oldAddress: address,
    newAddress: address
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(isAllowedTarget(oldAddress), ERROR_NOT_IN_WHITELIST);

    hasPending = true;
    pendingKind = PENDING_ADDRESS;
    pendingOldAddress = oldAddress;
    pendingNewAddress = newAddress;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun requestTaxChange(
    oldTaxMultiplier: int,
    newTaxMultiplier: int
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(oldTaxMultiplier == taxMultiplier, ERROR_INVALID_AMOUNT);
    assert(newTaxMultiplier >= MIN_TAX_MULTIPLIER, ERROR_INVALID_AMOUNT);
    assert(newTaxMultiplier <= MAX_TAX_MULTIPLIER, ERROR_LIMIT_EXCEEDED);

    hasPending = true;
    pendingKind = PENDING_TAX;
    pendingOldAddress = null;
    pendingNewAddress = null;
    pendingOldValue = oldTaxMultiplier;
    pendingNewValue = newTaxMultiplier;
}

fun applyAddressChange() {
    assert(pendingOldAddress != null, ERROR_NO_PENDING);
    assert(pendingNewAddress != null, ERROR_NO_PENDING);

    var oldAddress = pendingOldAddress!;
    var newAddress = pendingNewAddress!;

    if (oldAddress == bankDaoAddress) {
        bankDaoAddress = newAddress;
        return;
    }

    if (oldAddress == bankDefiAddress) {
        bankDefiAddress = newAddress;
        return;
    }

    if (oldAddress == bankDominumAddress) {
        bankDominumAddress = newAddress;
        return;
    }

    if (oldAddress == gasPoolAddress) {
        gasPoolAddress = newAddress;
        return;
    }

    throw(ERROR_NOT_IN_WHITELIST);
}

fun sendTaxToGasPool(queryId: int) {
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
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(jettonWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun refillGasPool(
    amount: int,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_TOP_UP, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
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
        .storeUint(queryId, 64)
        .storeCoins(amount)
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

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;
    var myBalance = contract.getOriginalBalance();

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(senderAddress == jettonWalletAddress, ERROR_NOT_VALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        assert(fromAddress == gasPoolAddress, ERROR_NOT_IN_WHITELIST);

        totalReceivedDom = totalReceivedDom + amount;
        saveData();
        return;
    }

    if (op == OP_REPLACE_TREASURY_ADDRESS) {
        requireTreasuryManager(senderAddress);

        var oldAddress = msgBody.loadAddress();
        var newAddress = msgBody.loadAddress();

        requestAddressChange(oldAddress, newAddress);
        saveData();
        return;
    }

    if (op == OP_CHANGE_TAX) {
        requireTreasuryManager(senderAddress);

        var oldTaxMultiplier = msgBody.loadUint(16);
        var newTaxMultiplier = msgBody.loadUint(16);

        requestTaxChange(oldTaxMultiplier, newTaxMultiplier);
        saveData();
        return;
    }

    if (op == OP_CONFIRM_TREASURY_REQUEST) {
        requireOwner(senderAddress);
        assert(hasPending, ERROR_NO_PENDING);

        if (pendingKind == PENDING_ADDRESS) {
            applyAddressChange();
        }

        if (pendingKind == PENDING_TAX) {
            taxMultiplier = pendingNewValue;
            sendTaxToGasPool(queryId);
        }

        clearPending();
        saveData();
        return;
    }

    if (op == OP_CANCEL_TREASURY_REQUEST) {
        requireOwner(senderAddress);
        assert(hasPending, ERROR_NO_PENDING);

        clearPending();
        saveData();
        return;
    }

    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);
        assert(amount + MIN_TON_FOR_STORAGE <= myBalance, ERROR_INSUFFICIENT_BALANCE);

        totalSentTon = totalSentTon + amount;
        saveData();

        sendTon(toAddress, amount, queryId);
        return;
    }

    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);
        assert(msgValue >= MIN_TON_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);

        totalSentDom = totalSentDom + amount;
        saveData();

        sendDom(toAddress, amount, queryId);
        return;
    }

    if (op == OP_REFILL_POOL) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(amount + MIN_TON_FOR_STORAGE <= myBalance, ERROR_INSUFFICIENT_BALANCE);

        totalSentTon = totalSentTon + amount;
        saveData();

        refillGasPool(amount, queryId);
        return;
    }

    if (op == OP_WITHDRAW_FROM_POOL) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        requestDomFromGasPool(amount, queryId);
        return;
    }

    throw(0xffff);
}

get fun getTreasuryPoolData(): (
    address, address, address, address, address, address, address, int, int, int, int
) {
    loadData();

    return (
        ownerAddress,
        treasuryManagerAddress,
        jettonWalletAddress,
        bankDaoAddress,
        bankDefiAddress,
        bankDominumAddress,
        gasPoolAddress,
        taxMultiplier,
        totalReceivedDom,
        totalSentDom,
        totalSentTon
    );
}

get fun getTreasuryPendingData(): (
    bool, int, address?, address?, int, int
) {
    loadData();

    return (
        hasPending,
        pendingKind,
        pendingOldAddress,
        pendingNewAddress,
        pendingOldValue,
        pendingNewValue
    );
}

get fun isTreasuryTargetAllowed(candidate: address): bool {
    loadData();
    return isAllowedTarget(candidate);
}
