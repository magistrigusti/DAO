import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// =====================================================
// BANK DOMINUM — главный банк экосистемы DOM
// =====================================================
// Управляется: ownerAddress (сид/QR)
// Функции:
// - управляет Gas Pool напрямую (вывод/пополнение)
// - может выводить TON и (опционально) DOM со своего jetton wallet
// Владельца не меняем.
// =====================================================

global ownerAddress: slice;
global gasPoolAddress: slice;
global domWalletAddress: slice;

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    gasPoolAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(gasPoolAddress)
            .storeSlice(domWalletAddress)
            .endCell()
    );
}

fun requireOwner(sender: slice) {
    assert(sender.equalSlices(ownerAddress), ERROR_NOT_OWNER);
}

fun sendTon(toAddress: slice, amount: int) {
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();
    sendRawMessage(msg, 1);
}

fun withdrawDomJettons(toAddress: slice, amount: int, queryId: int) {
    var transferBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(domWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(transferBody)
        .endCell();

    sendRawMessage(msg, 1);
}

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

    if (op == OP_UPDATE_GAS_POOL) {
        requireOwner(senderAddress);
        gasPoolAddress = msgBody.loadMsgAddress();
        saveData();
        return;
    }

    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        sendTon(toAddress, amount);
        return;
    }

    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();
        withdrawDomJettons(toAddress, amount, queryId);
        return;
    }

    if (op == OP_WITHDRAW_FROM_POOL) {
        requireOwner(senderAddress);
        var toAddress = msgBody.loadMsgAddress();
        var amount = msgBody.loadCoins();

        var body = beginCell()
            .storeUint(OP_WITHDRAW_DOM, 32)
            .storeUint(queryId, 64)
            .storeSlice(toAddress)
            .storeCoins(amount)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(MIN_TON_FOR_STORAGE)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 1);
        return;
    }

    if (op == OP_REFILL_POOL) {
        requireOwner(senderAddress);
        var tonAmount = msgBody.loadCoins();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(tonAmount)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .endCell();

        sendRawMessage(msg, 1);
        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }

    throw(0xffff);
}

get fun getBankDominumData(): (slice, slice, slice, int) {
    loadData();
    return (
        ownerAddress,
        gasPoolAddress,
        domWalletAddress,
        getBalance().0
    );
}