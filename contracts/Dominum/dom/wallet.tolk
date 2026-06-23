import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

// ========== DOM WALLET v2.3 ==========
// User transfer body:
// OP_TRANSFER | queryId | amount | toOwner | responseDest | paidFeeDom
//
// Wallet debits amount + paidFeeDom.
// TreasuryPool — постоянная точка маршрута между Wallet и активным GasPool.
// Если запрос отклонён или отскочил, Wallet восстанавливает полное списание
// from pendingTransfers by queryId.
// =====================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global balance: int;
global ownerAddress: address;
global masterAddress: address;
global treasuryPoolAddress: address;
global jettonWalletCode: cell;

// queryId -> totalSpend
global pendingTransfers: dict;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    treasuryPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();

    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();
    if ((bitsLeft > 0) | (refsLeft > 0)) {
        pendingTransfers = ds.loadDict();
    } else {
        pendingTransfers = createEmptyDict();
    }
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(treasuryPoolAddress)
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

    pendingTransfers.uDictSet(64, queryId, value);
}

fun readPendingTransfer(queryId: int): (int, bool) {
    var (value, found) = pendingTransfers.uDictGet(64, queryId);
    if (!found) {
        return (0, false);
    }

    var valueSlice = value!;

    return (valueSlice.loadCoins(), true);
}

fun deletePendingTransfer(queryId: int) {
    pendingTransfers.uDictDelete(64, queryId);
}

fun settlePendingTransfer(queryId: int) {
    var (_, found) = readPendingTransfer(queryId);

    if (!found) {
        return;
    }

    deletePendingTransfer(queryId);
    saveData();
}

fun restorePendingTransfer(queryId: int) {
    var (totalSpend, found) = readPendingTransfer(queryId);

    if (!found) {
        return;
    }

    balance += totalSpend;
    deletePendingTransfer(queryId);
    saveData();
}

// -----------------------------------------------------
// WALLET ADDRESS HELPERS
// -----------------------------------------------------
fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(treasuryPoolAddress)
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

    if (senderAddress == treasuryPoolAddress) {
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
fun handleBouncedMessage(senderAddress: address, msgBody: slice) {
    var bouncedOp = msgBody.loadUint(32);
    var bouncedQueryId = msgBody.loadUint(64);

    if (bouncedOp == OP_TREASURY_EXECUTE) {
        assert(senderAddress == treasuryPoolAddress, ERROR_NOT_VALID_WALLET);
        restorePendingTransfer(bouncedQueryId);
        return;
    }

    if (bouncedOp == OP_BURN_NOTIFICATION) {
        assert(senderAddress == masterAddress, ERROR_NOT_MASTER);

        var burnAmount = msgBody.loadCoins();

        if (burnAmount > 0) {
            balance += burnAmount;
            saveData();
        }

        return;
    }
}

fun onBouncedMessage(in: InMessageBounced) {
    var msgBody = in.bouncedBody;
    msgBody.skipBouncedPrefix();

    loadData();
    handleBouncedMessage(in.senderAddress, msgBody);
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

    var queryId = msgBody.loadUint(64);

    if (op == OP_TREASURY_SETTLE) {
        assert(senderAddress == treasuryPoolAddress, ERROR_NOT_VALID_WALLET);
        settlePendingTransfer(queryId);
        return;
    }

    if (op == OP_TREASURY_FAILED) {
        assert(senderAddress == treasuryPoolAddress, ERROR_NOT_VALID_WALLET);
        restorePendingTransfer(queryId);
        return;
    }

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

        saveData();

        notifyOwner(amount, fromOwner, queryId);
        return;
    }

    // =====================================================
    // OP_TRANSFER
    // body: amount | toOwner | responseDest | paidFeeDom
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var paidFeeDom = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(paidFeeDom > 0, ERROR_INVALID_AMOUNT);

        var totalSpend = jettonAmount + paidFeeDom;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);

        var (_, pendingExists) = readPendingTransfer(queryId);
        assert(!pendingExists, ERROR_ALREADY_INITIALIZED);

        setPendingTransfer(queryId, totalSpend);

        balance -= totalSpend;
        saveData();

        var gasPoolBody = beginCell()
            .storeUint(OP_TREASURY_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(toOwner)
            .storeAddress(ownerAddress)
            .storeCoins(paidFeeDom)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(treasuryPoolAddress)
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
        treasuryPoolAddress
    );
}

get fun getPendingTransfer(queryId: int): (int, bool) {
    loadData();
    return readPendingTransfer(queryId);
}
