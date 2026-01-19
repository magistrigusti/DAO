import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// INVEST DUAL-SIGN — двойное управление
// =====================================================
// Два сид-адреса.
// Первый создаёт заявку, второй подтверждает.
// Владельцы не меняются.
// =====================================================

const PENDING_NONE: int = 0;
const PENDING_TON: int = 1;
const PENDING_JETTONS: int = 2;

const OP_CANCEL_PENDING: int = 0x100;

// -----------------------------------------------------

global owner1Address: slice;
global owner2Address: slice;
global walletAddress: slice;

global pendingType: int;
global pendingAmount: int;
global pendingQueryId: int;
global pendingToAddress: slice;
global pendingSender: slice;

// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();

    owner1Address = ds.loadMsgAddress();
    owner2Address = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();

    pendingType = ds.loadUint(8);
    pendingAmount = ds.loadCoins();
    pendingQueryId = ds.loadUint(64);
    pendingToAddress = ds.loadMsgAddress();
    pendingSender = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(owner1Address)
            .storeSlice(owner2Address)
            .storeSlice(walletAddress)
            .storeUint(pendingType, 8)
            .storeCoins(pendingAmount)
            .storeUint(pendingQueryId, 64)
            .storeSlice(pendingToAddress)
            .storeSlice(pendingSender)
            .endCell()
    );
}

// -----------------------------------------------------

fun isOwner(sender: slice): int {
    if (sender.equalSlices(owner1Address)) {
        return true;
    }
    if (sender.equalSlices(owner2Address)) {
        return true;
    }
    return false;
}

fun clearPending() {
    pendingType = PENDING_NONE;
    pendingAmount = 0;
    pendingQueryId = 0;
    pendingToAddress = owner1Address;
    pendingSender = owner1Address;
}

fun setPending(
    newType: int,
    toAddress: slice,
    amount: int,
    queryId: int,
    sender: slice
) {
    pendingType = newType;
    pendingAmount = amount;
    pendingQueryId = queryId;
    pendingToAddress = toAddress;
    pendingSender = sender;
}

// -----------------------------------------------------

fun withdrawTon(toAddress: slice, amount: int) {
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();

    sendRawMessage(msg, 1);
}

fun withdrawJettons(toAddress: slice, amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(owner1Address)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(walletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------

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

    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }

    if (op == OP_CANCEL_PENDING) {
        assert(isOwner(senderAddress), ERROR_NOT_OWNER);

        clearPending();
        saveData();
        return;
    }

    if (op == OP_WITHDRAW) {
        assert(isOwner(senderAddress), ERROR_NOT_OWNER);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);

        if (pendingType == PENDING_NONE) {
            setPending(
                PENDING_TON,
                toAddress,
                amount,
                queryId,
                senderAddress
            );
            saveData();
            return;
        }

        assert(pendingType == PENDING_TON, ERROR_INVALID_AMOUNT);
        assert(!senderAddress.equalSlices(pendingSender), ERROR_NOT_OWNER);
        assert(pendingAmount == amount, ERROR_INVALID_AMOUNT);
        assert(pendingToAddress.equalSlices(toAddress), ERROR_INVALID_AMOUNT);

        withdrawTon(toAddress, amount);
        clearPending();
        saveData();
        return;
    }

    if (op == OP_WITHDRAW_JETTONS) {
        assert(isOwner(senderAddress), ERROR_NOT_OWNER);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);

        if (pendingType == PENDING_NONE) {
            setPending(
                PENDING_JETTONS,
                toAddress,
                amount,
                queryId,
                senderAddress
            );
            saveData();
            return;
        }

        assert(pendingType == PENDING_JETTONS, ERROR_INVALID_AMOUNT);
        assert(!senderAddress.equalSlices(pendingSender), ERROR_NOT_OWNER);
        assert(pendingAmount == amount, ERROR_INVALID_AMOUNT);
        assert(pendingToAddress.equalSlices(toAddress), ERROR_INVALID_AMOUNT);

        withdrawJettons(toAddress, amount, queryId);
        clearPending();
        saveData();
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------

get fun getInvestDualData(): (slice, slice, slice, int, int, slice) {
    loadData();

    return (
        owner1Address,
        owner2Address,
        walletAddress,
        pendingType,
        pendingAmount,
        pendingToAddress
    );
}