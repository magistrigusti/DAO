import "../core/op_codes";
import "../core/errors";
import "../core/constants";

global adminAddress: slice;
global masterAddress: slice;

fun loadData() {
    var ds = getContractData().beginParse();

    adminAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(masterAddress)
            .endCell()
    );
}

fun sendMint(amount: int, queryId: int, forwardValue: int) {
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(masterAddress)
        .storeCoins(forwardValue)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(
            beginCell()
                .storeUint(OP_MINT, 32)
                .storeUint(queryId, 64)
                .storeCoins(amount)
                .endCell()
        )
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

    if (flag & 1) {
        return;
    }

    var senderAddress = cs.loadMsgAddress();

    loadData();
}