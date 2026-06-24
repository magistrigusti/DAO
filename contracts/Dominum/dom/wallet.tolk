import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

// ========== DOM WALLET ==========
// OP_TRANSFER полностью соответствует TEP-74 и списывает только amount.
// OP_PROTOCOL_TRANSFER используется внутренними контрактами экосистемы:
// amount | destination | responseDestination | paidFeeDom.
//
// TreasuryPool — постоянная точка маршрута между Wallet и активным GasPool.
// Протокольный перевод списывает amount + paidFeeDom и хранит pending.
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
fun sendTransferNotification(
    amount: int,
    fromOwner: address,
    queryId: int,
    forwardGramsAmount: int,
    forwardPayload: slice
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeSlice(forwardPayload)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(ownerAddress)
        .storeCoins(forwardGramsAmount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendProtocolNotification(
    amount: int,
    fromOwner: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeBool(false)
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

fun sendExcesses(
    responseDestination: address?,
    amount: int,
    queryId: int
) {
    if ((responseDestination == null) | (amount <= 0)) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(responseDestination!)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendStandardInternalTransfer(
    toOwner: address,
    amount: int,
    responseDestination: address?,
    forwardGramsAmount: int,
    forwardPayload: slice,
    queryId: int
) {
    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(stateInit);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(ownerAddress)
        .storeAddressOpt(responseDestination)
        .storeCoins(forwardGramsAmount)
        .storeSlice(forwardPayload)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(toWallet)
        .storeCoins(0)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
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

    if (bouncedOp == OP_INTERNAL_TRANSFER) {
        var bouncedAmount = msgBody.loadCoins();

        if (bouncedAmount > 0) {
            balance += bouncedAmount;
            saveData();
        }

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
        var forwardGramsAmount = msgBody.loadCoins();
        var forwardPayload = msgBody;

        requireInternalSender(senderAddress, fromOwner);
        assert(amount > 0, ERROR_INVALID_AMOUNT);

        balance += amount;

        saveData();

        if (forwardGramsAmount > 0) {
            var excessAmount =
                msgValue -
                forwardGramsAmount -
                BASE_GRAMS_COST;

            sendTransferNotification(
                amount,
                fromOwner,
                queryId,
                forwardGramsAmount,
                forwardPayload
            );

            sendExcesses(
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
            sendProtocolNotification(amount, fromOwner, queryId);
            return;
        }

        sendExcesses(
            responseDestination,
            msgValue - BASE_GRAMS_COST,
            queryId
        );
        return;
    }

    // =====================================================
    // OP_TRANSFER — точный публичный формат TEP-74.
    // =====================================================
    if (op == OP_TRANSFER) {
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

        balance -= jettonAmount;
        saveData();

        sendStandardInternalTransfer(
            toOwner,
            jettonAmount,
            responseDestination,
            forwardGramsAmount,
            forwardPayload,
            queryId
        );
        return;
    }

    // =====================================================
    // OP_PROTOCOL_TRANSFER — перевод с комиссией DOM.
    // =====================================================
    if (op == OP_PROTOCOL_TRANSFER) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var paidFeeDom = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(paidFeeDom > 0, ERROR_INVALID_AMOUNT);

        var totalSpend = jettonAmount + paidFeeDom;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_GRAMS_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);

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
        var customPayload = msgBody.loadMaybeRef();

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
get fun get_wallet_data(): (
    int, address, address, cell
) {
    loadData();

    return (
        balance,
        ownerAddress,
        masterAddress,
        jettonWalletCode
    );
}

get fun get_protocol_data(): address {
    loadData();
    return treasuryPoolAddress;
}

get fun getPendingTransfer(queryId: int): (int, bool) {
    loadData();
    return readPendingTransfer(queryId);
}
