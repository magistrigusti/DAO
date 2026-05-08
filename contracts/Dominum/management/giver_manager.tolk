import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: address;

fun loadData() {
    var ds = contract.getData().beginParse();
    ownerAddress = ds.loadAddress();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .endCell()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun sendReplaceGiverRequest(
    masterAddress: address,
    oldGiverAddress: address,
    newGiverAddress: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_REPLACE_GIVER, 32)
        .storeUint(queryId, 64)
        .storeAddress(oldGiverAddress)
        .storeAddress(newGiverAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(masterAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

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

    if (op == OP_REPLACE_GIVER) {
        requireOwner(senderAddress);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        var masterAddress = msgBody.loadAddress();
        var oldGiverAddress = msgBody.loadAddress();
        var newGiverAddress = msgBody.loadAddress();

        sendReplaceGiverRequest(
            masterAddress,
            oldGiverAddress,
            newGiverAddress,
            queryId
        );

        return;
    }

    throw(0xffff);
}

get fun getManagerData(): address {
    loadData();
    return ownerAddress;
}
