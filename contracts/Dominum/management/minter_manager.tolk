import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// MINTER MANAGER — отдельный контракт смены minter.
// Сам Master не меняет. Он только подтверждает сообщение от этого контракта.

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

fun sendReplaceMinter(
    masterAddress: address,
    oldMinterAddress: address,
    newMinterAddress: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_REPLACE_MINTER, 32)
        .storeUint(queryId, 64)
        .storeAddress(oldMinterAddress)
        .storeAddress(newMinterAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(masterAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendReplaceManagerRequest(
    masterAddress: address,
    oldManagerAddress: address,
    newManagerAddress: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_REPLACE_MANAGER, 32)
        .storeUint(queryId, 64)
        .storeUint(MANAGER_TARGET_MINTER, 8)
        .storeAddress(oldManagerAddress)
        .storeAddress(newManagerAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(masterAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
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

    if (op == OP_REPLACE_MINTER) {
        requireOwner(senderAddress);
        assert(msgValue >= MIN_GRAMS_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        var masterAddress = msgBody.loadAddress();
        var oldMinterAddress = msgBody.loadAddress();
        var newMinterAddress = msgBody.loadAddress();

        sendReplaceMinter(
            masterAddress,
            oldMinterAddress,
            newMinterAddress,
            queryId
        );

        return;
    }

    if (op == OP_REPLACE_MANAGER) {
        requireOwner(senderAddress);
        assert(msgValue >= MIN_GRAMS_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        var masterAddress = msgBody.loadAddress();
        var oldManagerAddress = msgBody.loadAddress();
        var newManagerAddress = msgBody.loadAddress();

        sendReplaceManagerRequest(
            masterAddress,
            oldManagerAddress,
            newManagerAddress,
            queryId
        );
        return;
    }

    throw(0xffff);
}

get fun getMinterManagerData(): address {
    loadData();

    return ownerAddress;
}
