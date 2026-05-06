import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== DOM WALLET v2.3 ==========
// User transfer body:
// OP_TRANSFER | queryId | amount | toOwner | responseDest | maxFeeDom
//
// Wallet debits amount + maxFeeDom.
// If the message bounces before GasPool settlement, wallet restores full debit
// from pendingTransfers by queryId.
// =====================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address; // proxy address
global jettonWalletCode: cell;

// queryId -> totalSpend
global pendingTransfers: cell;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();

    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();
    if ((bitsLeft > 0) | (refsLeft > 0)) {
        pendingTransfers = ds.loadDict();
    } else {
        pendingTransfers = beginCell().endCell();
    }
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .storeDict(pendingTransfers)
            .endCell()
    );
}

// -----------------------------------------------------
// PENDING TRANSFERS
// -----------------------------------------------------
fun setPendingTransfer(queryId: int, totalSpend: int) {
    var value = beginCell()
        .storeCoins(totalSpend)
        .endCell()
        .beginParse();

    pendingTransfers = pendingTransfers.udictSet(64, queryId, value);
}

fun getPendingTransfer(queryId: int): (int, bool) {
    var (value, found) = pendingTransfers.udictGet(64, queryId);
    if (!found) {
        return (0, false);
    }

    return (value.loadCoins(), true);
}

fun deletePendingTransfer(queryId: int) {
    var (newDict, deleted) = pendingTransfers.udictDelete(64, queryId);
    if (deleted) {
        pendingTransfers = newDict;
    }
}

fun tryClearSettledPending(queryId: int, senderAddress: address) {
    if (senderAddress != gasPoolAddress) {
        return;
    }

    if (queryId < 2) {
        return;
    }

    var originalQueryId = queryId - 2;
    var (_, found) = getPendingTransfer(originalQueryId);

    if (found) {
        deletePendingTransfer(originalQueryId);
    }
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------
fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: address): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        wc,
        stateInit.hash()
    );
}

// -----------------------------------------------------
// VALIDATION
// -----------------------------------------------------
fun requireInternalSender(
    senderAddress: address,
    fromOwner: address
) {
    if (senderAddress == masterAddress) {
        return;
    }

    if (senderAddress == gasPoolAddress) {
        return;
    }

    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );

    assert(senderAddress == expectedWallet, ERROR_NOT_VALID_WALLET);
}

// -----------------------------------------------------
// OWNER NOTIFICATION
// -----------------------------------------------------
fun notifyOwner(
    amount: int,
    fromOwner: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

// -----------------------------------------------------
// BOUNCE HANDLER
// -----------------------------------------------------
fun handleBouncedMessage(msgBody: slice) {
    var bouncedOp = msgBody.loadUint(32);
    var bouncedQueryId = msgBody.loadUint(64);

    if (bouncedOp == OP_GAS_POOL_EXECUTE) {
        var (totalSpend, found) = getPendingTransfer(bouncedQueryId);

        if (found) {
            balance += totalSpend;
            deletePendingTransfer(bouncedQueryId);
            saveData();
        }

        return;
    }

    if (bouncedOp == OP_BURN_NOTIFICATION) {
        var burnAmount = msgBody.loadCoins();

        if (burnAmount > 0) {
            balance += burnAmount;
            saveData();
        }

        return;
    }
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);

    if (op == 0xffffffff) {
        handleBouncedMessage(msgBody);
        return;
    }

    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_INTERNAL_TRANSFER
    // body: amount | fromOwner | responseDest
    // =====================================================
    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();

        requireInternalSender(senderAddress, fromOwner);

        balance += amount;

        // GasPool sends refund/settlement with queryId + 2.
        tryClearSettledPending(queryId, senderAddress);

        saveData();

        notifyOwner(amount, fromOwner, queryId);
        return;
    }

    // =====================================================
    // OP_TRANSFER
    // body: amount | toOwner | responseDest | maxFeeDom
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var maxFeeDom = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(maxFeeDom > 0, ERROR_INVALID_AMOUNT);

        var totalSpend = jettonAmount + maxFeeDom;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);

        var (_, pendingExists) = getPendingTransfer(queryId);
        assert(!pendingExists, ERROR_ALREADY_INITIALIZED);

        setPendingTransfer(queryId, totalSpend);

        balance -= totalSpend;
        saveData();

        var gasPoolBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(toOwner)
            .storeAddress(ownerAddress)
            .storeCoins(maxFeeDom)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(gasPoolAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(gasPoolBody)
            .endCell();

        sendRawMessage(msg, 64);
        return;
    }

    // =====================================================
    // OP_BURN
    // body: amount | responseDest
    // =====================================================
    if (op == OP_BURN) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadAddressOpt();

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

        balance -= burnAmount;
        saveData();

        var body = beginCell()
            .storeUint(OP_BURN_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(burnAmount)
            .storeAddress(ownerAddress)
            .storeAddressOpt(responseDestination)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(masterAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 64);
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getWalletData(): (
    int, address, address, address
) {
    loadData();

    return (
        balance,
        ownerAddress,
        masterAddress,
        gasPoolAddress
    );
}

get fun getPendingTransfer(queryId: int): (int, bool) {
    loadData();
    return getPendingTransfer(queryId);
}
