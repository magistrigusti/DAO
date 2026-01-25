import "../core/op_codes";
import "../core/errors";
import "../core/constants";

global ownerAddress: slice;
global treasuryManagerAddress: slice;

global domWalletAddress: slice;

fun loadData() {
    var ds = getContractData().beginParse();

    ownerAddress = ds.loadMsgAddress();
    treasuryManagerAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(treasuryManagerAddress)
            .storeSlice(domWalletAddress)
            .endCell()
    );
}

fun requireOwner(sender: slice) {
    assert(sender.equalSlices(ownerAddress), ERROR_NOT_OWNER);
}

fun sendToTreasuryManager(
    op: int,
    body: cell,
    value: int,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(op, 32)
        .storeUint(queryId, 64)
        .storeRef(body)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(treasuryManagerAddress)
        .storeCoins(value)
        .storeUiunt(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
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
){
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

    if (op == OP_CHANGE_TREASURY_MANAGER) {
        requireOwner(senderAddress);

        var newManager = msgBody.loadMsgAddress();
        treasuryManagerAddress = newManager;
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
}