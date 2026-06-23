import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

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
global walletConfigured: bool;

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
global pendingTargetKind: int;
global pendingOldAddress: address?;
global pendingNewAddress: address?;
global pendingOldValue: int;
global pendingNewValue: int;

// Внутренний routeId отделён от queryId конкретного Wallet.
// Это позволяет безопасно вернуть отказ при bounce от GasPool.
global nextRouteId: int;
global pendingRoutes: dict;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    treasuryManagerAddress = ds.loadAddress();
    jettonWalletAddress = ds.loadAddress();
    walletConfigured = ds.loadBool();

    var targets = ds.loadRef().beginParse();
    var bankTargets = targets.loadRef().beginParse();
    var poolTargets = targets.loadRef().beginParse();

    bankDaoAddress = bankTargets.loadAddress();
    bankDefiAddress = bankTargets.loadAddress();
    bankDominumAddress = poolTargets.loadAddress();
    gasPoolAddress = poolTargets.loadAddress();

    var stats = ds.loadRef().beginParse();
    taxMultiplier = stats.loadUint(16);
    totalReceivedDom = stats.loadCoins();
    totalSentDom = stats.loadCoins();
    totalSentTon = stats.loadCoins();

    var pending = ds.loadRef().beginParse();
    hasPending = pending.loadBool();
    pendingKind = pending.loadUint(8);
    pendingTargetKind = pending.loadUint(8);
    pendingOldAddress = pending.loadAddressOpt();
    pendingNewAddress = pending.loadAddressOpt();
    pendingOldValue = pending.loadUint(32);
    pendingNewValue = pending.loadUint(32);

    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();

    if (refsLeft > 0) {
        var routing = ds.loadRef().beginParse();
        nextRouteId = routing.loadUint(64);
        pendingRoutes = routing.loadDict();
    } else {
        nextRouteId = 1;
        pendingRoutes = createEmptyDict();
    }
}

fun saveData() {
    var bankTargets = beginCell()
        .storeAddress(bankDaoAddress)
        .storeAddress(bankDefiAddress)
        .endCell();

    var poolTargets = beginCell()
        .storeAddress(bankDominumAddress)
        .storeAddress(gasPoolAddress)
        .endCell();

    var targets = beginCell()
        .storeRef(bankTargets)
        .storeRef(poolTargets)
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
        .storeUint(pendingTargetKind, 8)
        .storeAddressOpt(pendingOldAddress)
        .storeAddressOpt(pendingNewAddress)
        .storeUint(pendingOldValue, 32)
        .storeUint(pendingNewValue, 32)
        .endCell();

    var routing = beginCell()
        .storeUint(nextRouteId, 64)
        .storeDict(pendingRoutes)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(treasuryManagerAddress)
            .storeAddress(jettonWalletAddress)
            .storeBool(walletConfigured)
            .storeRef(targets)
            .storeRef(stats)
            .storeRef(pending)
            .storeRef(routing)
            .endCell()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun requireTreasuryManager(senderAddress: address) {
    assert(senderAddress == treasuryManagerAddress, ERROR_NOT_MANAGER);
}

fun requireWalletConfigured() {
    assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun initWalletConfig(newJettonWalletAddress: address) {
    assert(!walletConfigured, ERROR_ALREADY_INITIALIZED);
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(totalReceivedDom == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSentDom == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSentTon == 0, ERROR_ALREADY_INITIALIZED);

    jettonWalletAddress = newJettonWalletAddress;
    walletConfigured = true;

    saveData();
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

fun isExpectedTarget(
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

fun clearPending() {
    hasPending = false;
    pendingKind = PENDING_NONE;
    pendingTargetKind = 0;
    pendingOldAddress = null;
    pendingNewAddress = null;
    pendingOldValue = 0;
    pendingNewValue = 0;
}

fun createPendingRoute(
    walletAddress: address,
    walletQueryId: int
): int {
    var routeId = nextRouteId;

    nextRouteId = nextRouteId + 1;

    var route = beginCell()
        .storeAddress(walletAddress)
        .storeUint(walletQueryId, 64)
        .endCell()
        .beginParse();

    pendingRoutes.uDictSet(64, routeId, route);

    return routeId;
}

fun readPendingRoute(
    routeId: int
): (address?, int, bool) {
    var (route, found) = pendingRoutes.uDictGet(64, routeId);

    if (!found) {
        return (null, 0, false);
    }

    var routeSlice = route!;
    var walletAddress = routeSlice.loadAddress();
    var walletQueryId = routeSlice.loadUint(64);

    return (walletAddress, walletQueryId, true);
}

fun deletePendingRoute(routeId: int) {
    pendingRoutes.uDictDelete(64, routeId);
}

fun requestAddressChange(
    targetKind: int,
    oldAddress: address,
    newAddress: address
) {
    assert(!hasPending, ERROR_ALREADY_INITIALIZED);
    assert(oldAddress != newAddress, ERROR_INVALID_AMOUNT);
    assert(
        isExpectedTarget(targetKind, oldAddress),
        ERROR_WRONG_TARGET
    );

    hasPending = true;
    pendingKind = PENDING_ADDRESS;
    pendingTargetKind = targetKind;
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
    pendingTargetKind = 0;
    pendingOldAddress = null;
    pendingNewAddress = null;
    pendingOldValue = oldTaxMultiplier;
    pendingNewValue = newTaxMultiplier;
}

fun applyAddressChange(queryId: int) {
    assert(pendingOldAddress != null, ERROR_NO_PENDING);
    assert(pendingNewAddress != null, ERROR_NO_PENDING);

    var oldAddress = pendingOldAddress!;
    var newAddress = pendingNewAddress!;

    if (pendingTargetKind == TREASURY_TARGET_BANK_DAO) {
        assert(oldAddress == bankDaoAddress, ERROR_NOT_IN_WHITELIST);
        bankDaoAddress = newAddress;
        return;
    }

    if (pendingTargetKind == TREASURY_TARGET_BANK_DEFI) {
        assert(oldAddress == bankDefiAddress, ERROR_NOT_IN_WHITELIST);
        bankDefiAddress = newAddress;
        return;
    }

    if (pendingTargetKind == TREASURY_TARGET_BANK_DOMINUM) {
        assert(oldAddress == bankDominumAddress, ERROR_NOT_IN_WHITELIST);
        bankDominumAddress = newAddress;
        return;
    }

    if (pendingTargetKind == TREASURY_TARGET_GAS_POOL) {
        assert(oldAddress == gasPoolAddress, ERROR_NOT_IN_WHITELIST);
        gasPoolAddress = newAddress;
        sendTaxToGasPool(queryId);
        return;
    }

    throw(ERROR_WRONG_TARGET);
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

fun sendInitMasterConfigToGasPool(
    newMasterAddress: address,
    newJettonWalletCode: cell,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_INIT_MASTER_CONFIG, 32)
        .storeUint(queryId, 64)
        .storeAddress(newMasterAddress)
        .storeRef(newJettonWalletCode)
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
    requireWalletConfigured();

    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
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

fun forwardExecution(
    senderWalletAddress: address,
    msgBody: slice,
    walletQueryId: int
) {
    var jettonAmount = msgBody.loadCoins();
    var toOwner = msgBody.loadAddress();
    var fromOwner = msgBody.loadAddress();
    var paidFeeDom = msgBody.loadCoins();

    var routeId = createPendingRoute(
        senderWalletAddress,
        walletQueryId
    );

    saveData();

    var body = beginCell()
        .storeUint(OP_GAS_POOL_EXECUTE, 32)
        .storeUint(routeId, 64)
        .storeAddress(senderWalletAddress)
        .storeCoins(jettonAmount)
        .storeAddress(toOwner)
        .storeAddress(fromOwner)
        .storeCoins(paidFeeDom)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun forwardSettlement(
    routeId: int,
    success: bool
) {
    var (walletAddressOpt, walletQueryId, found) =
        readPendingRoute(routeId);

    assert(found, ERROR_NO_PENDING);
    assert(walletAddressOpt != null, ERROR_NO_PENDING);

    var walletAddress = walletAddressOpt!;
    var settlementOp = OP_TREASURY_FAILED;

    if (success) {
        settlementOp = OP_TREASURY_SETTLE;
    }

    deletePendingRoute(routeId);
    saveData();

    var body = beginCell()
        .storeUint(settlementOp, 32)
        .storeUint(walletQueryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun forwardWalletDelivery(msgBody: slice) {
    var walletAddress = msgBody.loadAddress();
    var walletStateInit = msgBody.loadRef();
    var walletBody = msgBody.loadRef();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(0)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(walletStateInit)
        .storeRef(walletBody)
        .endCell();

    sendRawMessage(msg, 64);
}

fun onBouncedMessage(in: InMessageBounced) {
    var msgBody = in.bouncedBody;
    msgBody.skipBouncedPrefix();

    loadData();

    var bouncedOp = msgBody.loadUint(32);
    var routeId = msgBody.loadUint(64);

    if (bouncedOp == OP_GAS_POOL_EXECUTE) {
        assert(in.senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        forwardSettlement(routeId, false);
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

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_TREASURY_EXECUTE) {
        forwardExecution(senderAddress, msgBody, queryId);
        return;
    }

    if (op == OP_TREASURY_SETTLE) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_OWNER);

        var success = msgBody.loadBool();

        forwardSettlement(queryId, success);
        return;
    }

    if (op == OP_TREASURY_DELIVER) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_OWNER);
        forwardWalletDelivery(msgBody);
        return;
    }

    if (op == OP_INIT_TREASURY_WALLET_CONFIG) {
        requireOwner(senderAddress);

        var newJettonWalletAddress = msgBody.loadAddress();

        initWalletConfig(newJettonWalletAddress);

        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        requireWalletConfigured();
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

        var targetKind = msgBody.loadUint(8);
        var oldAddress = msgBody.loadAddress();
        var newAddress = msgBody.loadAddress();

        requestAddressChange(targetKind, oldAddress, newAddress);
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

    if (op == OP_INIT_MASTER_CONFIG) {
        requireOwner(senderAddress);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        var newMasterAddress = msgBody.loadAddress();
        var newJettonWalletCode = msgBody.loadRef();

        sendInitMasterConfigToGasPool(
            newMasterAddress,
            newJettonWalletCode,
            queryId
        );

        return;
    }

    if (op == OP_CONFIRM_TREASURY_REQUEST) {
        requireOwner(senderAddress);
        assert(hasPending, ERROR_NO_PENDING);

        if (pendingKind == PENDING_ADDRESS) {
            applyAddressChange(queryId);
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
    address, address, address, bool,
    address, address, address, address,
    int, int, int, int, int
) {
    loadData();

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
        totalSentTon,
        nextRouteId
    );
}

get fun getTreasuryPendingData(): (
    bool, int, int, address?, address?, int, int
) {
    loadData();

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
    loadData();
    return isAllowedTarget(candidate);
}
