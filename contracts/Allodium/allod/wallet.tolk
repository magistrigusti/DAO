import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

// =====================================================
// ALLOD WALLET
// =====================================================
// OP_TRANSFER полностью соответствует TEP-74 и списывает только amount.
// OP_PROTOCOL_TRANSFER используется внутренними контрактами:
// amount | destination | responseDestination | paidFeeAllod.
//
// AllodGasPool оплачивает внутренние сообщения в TON.
// =====================================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;
global jettonWalletCode: cell;

// queryId -> amount + paidFeeAllod
global pendingTransfers: dict;

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

    // Старые initial-data могут не содержать словарь.
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

    balance = balance + totalSpend;

    deletePendingTransfer(queryId);
    saveData();
}

// -----------------------------------------------------
// WALLET ADDRESS
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

fun buildWalletAddress(owner: address): address {
    var stateInit = buildWalletStateInit(owner);
    var workchain = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(workchain, stateInit.hash());
}

// -----------------------------------------------------
// VALIDATION
// -----------------------------------------------------

fun requireInternalSender(senderAddress: address, fromOwner: address) {
    // Mint от AllodMaster.
    if (senderAddress == masterAddress) {
        return;
    }

    // Перевод, исполненный AllodGasPool.
    if (senderAddress == gasPoolAddress) {
        return;
    }

    // Обычный перевод от другого ALLOD wallet.
    var expectedWallet = buildWalletAddress(fromOwner);

    assert(senderAddress == expectedWallet, ERROR_NOT_VALID_WALLET);
}

// -----------------------------------------------------
// OWNER NOTIFICATION
// -----------------------------------------------------

fun sendTransferNotification(
    amount: int,
    fromOwner: address,
    queryId: int,
    forwardTonAmount: int,
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
        .storeCoins(forwardTonAmount)
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
    forwardTonAmount: int,
    forwardPayload: slice,
    queryId: int
) {
    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(toOwner);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(ownerAddress)
        .storeAddressOpt(responseDestination)
        .storeCoins(forwardTonAmount)
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
// SEND GAS POOL REQUEST
// -----------------------------------------------------

fun sendGasPoolExecute(jettonAmount: int, toOwner: address, paidFeeAllod: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_ALLOD_GAS_POOL_EXECUTE, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(toOwner)
        .storeAddress(ownerAddress)
        .storeCoins(paidFeeAllod)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    // Передаем GasPool остаток attached TON.
    sendRawMessage(msg, 64);
}

// -----------------------------------------------------
// BOUNCED MESSAGES
// -----------------------------------------------------

fun handleBouncedMessage(senderAddress: address, msgBody: slice) {
    var bouncedOp = msgBody.loadUint(32);
    var bouncedQueryId = msgBody.loadUint(64);

    if (bouncedOp == OP_ALLOD_GAS_POOL_EXECUTE) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_VALID_WALLET);

        restorePendingTransfer(bouncedQueryId);
        return;
    }

    if (bouncedOp == OP_INTERNAL_TRANSFER) {
        var bouncedAmount = msgBody.loadCoins();

        if (bouncedAmount > 0) {
            balance = balance + bouncedAmount;
            saveData();
        }

        return;
    }

    if (bouncedOp == OP_BURN_NOTIFICATION) {
        assert(senderAddress == masterAddress, ERROR_NOT_MASTER);

        var burnAmount = msgBody.loadCoins();

        if (burnAmount > 0) {
            balance = balance + burnAmount;
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
// INTERNAL MESSAGES
// -----------------------------------------------------

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    // Пустое сообщение используется
    // для пополнения TON-баланса wallet.
    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // -------------------------------------------------
    // GAS POOL SETTLEMENT
    // -------------------------------------------------
    // GasPool подтверждает успешное исполнение
    // стандартным OP_EXCESSES.

    if (op == OP_EXCESSES) {
        assert(senderAddress == gasPoolAddress, ERROR_NOT_VALID_WALLET);

        settlePendingTransfer(queryId);
        return;
    }

    // -------------------------------------------------
    // INTERNAL TRANSFER
    // -------------------------------------------------

    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var forwardTonAmount = msgBody.loadCoins();
        var forwardPayload = msgBody;

        assert(amount > 0, ERROR_INVALID_AMOUNT);

        requireInternalSender(senderAddress, fromOwner);

        balance = balance + amount;
        saveData();

        if (forwardTonAmount > 0) {
            var excessAmount =
                msgValue -
                forwardTonAmount -
                MIN_TON_FOR_TRANSFER;

            sendTransferNotification(
                amount,
                fromOwner,
                queryId,
                forwardTonAmount,
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
            (senderAddress == gasPoolAddress)
        ) {
            sendProtocolNotification(amount, fromOwner, queryId);
            return;
        }

        sendExcesses(
            responseDestination,
            msgValue - MIN_TON_FOR_TRANSFER,
            queryId
        );
        return;
    }

    // -------------------------------------------------
    // USER TRANSFER
    // -------------------------------------------------
    if (op == OP_TRANSFER) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var customPayload = msgBody.loadMaybeRef();
        var forwardTonAmount = msgBody.loadCoins();
        var forwardPayload = msgBody;

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= jettonAmount, ERROR_INSUFFICIENT_BALANCE);
        assert(
            msgValue >= MIN_TON_FOR_TRANSFER + forwardTonAmount,
            ERROR_INSUFFICIENT_GAS
        );

        balance = balance - jettonAmount;
        saveData();

        sendStandardInternalTransfer(
            toOwner,
            jettonAmount,
            responseDestination,
            forwardTonAmount,
            forwardPayload,
            queryId
        );
        return;
    }

    if (op == OP_PROTOCOL_TRANSFER) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressOpt();
        var paidFeeAllod = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(paidFeeAllod > 0, ERROR_INVALID_AMOUNT);

        var totalSpend = jettonAmount + paidFeeAllod;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_TRANSFER, ERROR_INSUFFICIENT_GAS);

        var (_, pendingExists) = readPendingTransfer(queryId);

        assert(!pendingExists, ERROR_ALREADY_INITIALIZED);

        setPendingTransfer(queryId, totalSpend);

        balance = balance - totalSpend;
        saveData();

        sendGasPoolExecute(jettonAmount, toOwner, paidFeeAllod, queryId);
        return;
    }

    // -------------------------------------------------
    // BURN
    // -------------------------------------------------

    if (op == OP_BURN) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);

        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadAddressOpt();
        var customPayload = msgBody.loadMaybeRef();

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        balance = balance - burnAmount;
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

get fun get_wallet_data(): (int, address, address, cell) {
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
    return gasPoolAddress;
}

get fun getPendingTransfer(queryId: int): (int, bool) {
    loadData();

    return readPendingTransfer(queryId);
}
