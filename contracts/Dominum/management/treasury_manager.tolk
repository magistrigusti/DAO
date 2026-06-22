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

fun sendAddressRequest(
    treasuryPoolAddress: address,
    targetKind: int,
    oldAddress: address,
    newAddress: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_REPLACE_TREASURY_ADDRESS, 32)
        .storeUint(queryId, 64)
        .storeUint(targetKind, 8)
        .storeAddress(oldAddress)
        .storeAddress(newAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendTaxRequest(
    treasuryPoolAddress: address,
    oldTaxMultiplier: int,
    newTaxMultiplier: int,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_CHANGE_TAX, 32)
        .storeUint(queryId, 64)
        .storeUint(oldTaxMultiplier, 16)
        .storeUint(newTaxMultiplier, 16)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
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

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_REPLACE_TREASURY_ADDRESS) {
        requireOwner(senderAddress);

        var treasuryPoolAddress = msgBody.loadAddress();
        var targetKind = msgBody.loadUint(8);
        var oldAddress = msgBody.loadAddress();
        var newAddress = msgBody.loadAddress();

        sendAddressRequest(
            treasuryPoolAddress,
            targetKind,
            oldAddress,
            newAddress,
            queryId
        );

        return;
    }

    if (op == OP_CHANGE_TAX) {
        requireOwner(senderAddress);

        var treasuryPoolAddress = msgBody.loadAddress();
        var oldTaxMultiplier = msgBody.loadUint(16);
        var newTaxMultiplier = msgBody.loadUint(16);

        sendTaxRequest(
            treasuryPoolAddress,
            oldTaxMultiplier,
            newTaxMultiplier,
            queryId
        );

        return;
    }

    throw(0xffff);
}

get fun getTreasuryManagerData(): address {
    loadData();
    return ownerAddress;
}
