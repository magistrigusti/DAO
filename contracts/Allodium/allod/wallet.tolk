// =====================================================
// WALLET ALLOD — Jetton Wallet с TON-налогом
// =====================================================
// Налог: каждая OP_TRANSFER операция платит 0.05 TON
// Налог отправляется на foundationAddress
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================
global balance: int;
global ownerAddress: slice;
global masterAddress: slice;
global foundationAddress: slice;
global jettonWalletCode: cell;

// =====================================================
// LOAD / SAVE
// =====================================================
fun loadData() {
    var ds = getContractData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
    foundationAddress = ds.loadMsgAddress();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeCoins(balance)
            .storeSlice(ownerAddress)
            .storeSlice(masterAddress)
            .storeSlice(foundationAddress)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// =====================================================
// WALLET ADDRESS HELPERS
// =====================================================
fun buildWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(masterAddress)
        .storeSlice(foundationAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// =====================================================
// VALIDATE INTERNAL SENDER
// =====================================================
fun requireInternalSender(
    senderAddress: slice,
    fromOwner: slice
) {
    // mint от Master
    if (senderAddress.equalSlices(masterAddress)) {
        return;
    }

    // transfer от wallet другого владельца
    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );

    assert(
        senderAddress.equalSlices(expectedWallet),
        ERROR_NOT_VALID_WALLET
    );
}

// =====================================================
// NOTIFY OWNER
// =====================================================
fun notifyOwner(amount: int, fromOwner: slice, queryId: int) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(fromOwner)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

// =====================================================
// SEND INTERNAL TRANSFER
// =====================================================
fun sendInternalTransfer(
    toOwner: slice,
    amount: int,
    fromOwner: slice,
    responseDestination: slice,
    queryId: int,
    forwardValue: int
) {
    if (amount <= 0) {
        return;
    }

    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(stateInit);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(fromOwner)
        .storeSlice(responseDestination)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toWallet)
        .storeCoins(forwardValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// =====================================================
// SEND TAX TON -> FOUNDATION
// =====================================================
fun sendTaxTon() {
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(foundationAddress)
        .storeCoins(TAX_ALLOD_TON)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();

    sendRawMessage(msg, 1);
}

// =====================================================
// SEND EXCESS TON
// =====================================================
fun sendExcess(toAddress: slice, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    if (toAddress.isAddressNone()) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// =====================================================
// MAIN
// =====================================================
fun onInternalMessage(
    myBalance: int,
    msgValue: int,
    msgFull: cell,
    msgBody: slice
) {
    if (msgBody.isEndOfSlice()) {
        return;
    }

    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);

    if (flags & 1) {
        return;
    }

    var senderAddress = cs.loadMsgAddress();

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_INTERNAL_TRANSFER — получили ALLOD
    // =====================================================
    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();

        requireInternalSender(senderAddress, fromOwner);

        balance += amount;
        saveData();

        notifyOwner(amount, fromOwner, queryId);
        return;
    }

    // =====================================================
    // OP_TRANSFER — отправка ALLOD (с налогом 0.05 TON)
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();

        var hasCustom = msgBody.loadBool();
        if (hasCustom) {
            // custom_payload пока не используем
            msgBody.loadRef();
        }

        var forwardTonAmount = msgBody.loadCoins();
        var hasForwardPayload = msgBody.loadBool();
        if (hasForwardPayload) {
            msgBody.loadRef();
        }

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= jettonAmount, ERROR_INSUFFICIENT_BALANCE);

        // В этой версии forward payload не поддерживаем
        assert(forwardTonAmount == 0, ERROR_INVALID_AMOUNT);

        var requiredTon = TAX_ALLOD_TON + MIN_TON_FOR_STORAGE;
        assert(msgValue >= requiredTon, ERROR_INSUFFICIENT_GAS);

        balance -= jettonAmount;
        saveData();

        // 1) Налог 0.05 TON на foundation
        sendTaxTon();

        // 2) Отправка ALLOD получателю
        sendInternalTransfer(
            toOwner,
            jettonAmount,
            ownerAddress,
            responseDestination,
            queryId,
            MIN_TON_FOR_STORAGE
        );

        // 3) Возврат излишка TON
        var excessTon = msgValue - requiredTon;
        sendExcess(responseDestination, excessTon, queryId);

        return;
    }

    // =====================================================
    // OP_BURN — сжечь ALLOD
    // =====================================================
    if (op == OP_BURN) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadMsgAddress();

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        balance -= burnAmount;
        saveData();

        var body = beginCell()
            .storeUint(OP_BURN_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(burnAmount)
            .storeSlice(ownerAddress)
            .storeSlice(responseDestination)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(masterAddress)
            .storeCoins(msgValue)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 1);
        return;
    }

    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================
get fun getWalletData(): (int, slice, slice, slice) {
    loadData();

    return (
        balance,
        ownerAddress,
        masterAddress,
        foundationAddress
    );
}