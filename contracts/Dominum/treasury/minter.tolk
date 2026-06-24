import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// MINTER — отдельный контракт разрешения минта.
// Сам DOM не выпускает. Только отправляет разрешение в Master.

global ownerAddress: address;
global masterAddress: address;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .endCell()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun sendMintPermission(
    amount: int,
    queryId: int,
    tonForMaster: int
) {
    var body = beginCell()
        .storeUint(OP_MINT, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(masterAddress)
        .storeCoins(tonForMaster)
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

    if (op == OP_MINT) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();

        assert(amount >= MIN_MINT_AMOUNT, ERROR_INVALID_AMOUNT);
        assert(amount <= MAX_MINT_AMOUNT, ERROR_LIMIT_EXCEEDED);

        var requiredGrams = MIN_GRAMS_FOR_TRANSFER * GIVERS_COUNT;

        assert(
            msgValue >= requiredGrams + MIN_GRAMS_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );

        sendMintPermission(
            amount,
            queryId,
            requiredGrams
        );

        return;
    }

    throw(0xffff);
}

get fun getMinterData(): (address, address) {
    loadData();

    return (
        ownerAddress,
        masterAddress
    );
}
