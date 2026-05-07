import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global walletAddress: address?;
global marketAddress: address;
global foundryAddress: address;
global defiTreasuryAddress: address;

fun loadData() {
    var ds = contract.getData().beginParse();
    walletAddress = ds.loadAddressOpt();

    var targets = ds.loadRef().beginParse();
    marketAddress = targets.loadAddress();
    foundryAddress = targets.loadAddress();
    defiTreasuryAddress = targets.loadAddress();
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(marketAddress)
        .storeAddress(foundryAddress)
        .storeAddress(defiTreasuryAddress)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddressOpt(walletAddress)
            .storeRef(targets)
            .endCell()
    );
}

fun sendJettons(toAddress: address, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    assert(walletAddress != null, ERROR_NOT_VALID_WALLET);

    var body = beginCell()
        .storeUnit(OP_TRANSFER, 32)
        .storeUnit(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress!)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun autoDistribute(amount: int, queryId: int) {
    var feeReserve = GIVER_MAX_FEE_DOM * 3;
    asert(amount > feeReserve, ERROR_INVALID_AMOUNT);

    var distributable = amount - feeReserve;

    var marketPart = distributable * 20 / 100;
    var foundryPart = distributable * 40 / 100;
    var defiPart = distributable - marketPart - foundryPart;

    sendJettons(marketAddress, marketPart, queryId);
    sendJettons(foundryAddress, foundryPart, queryId + 1);
    sendJettons(defiTreasuryAddress, defiPart, queryId + 2);
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(walletAddress != null, ERROR_NOT_VALID_WALLET);
        assert(senderAddress == walletAddress!, ERROR_NOT_VALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        autoDistribute(amount, queryId);
        return;
    }

    if (op == OP_SET_WALLET) {
        assert(senderAddress == managerAddress, ERROR_NOT_MANAGER);
        walletAddress = msgBody.loadAddress();
        saveData();
        return;
    }

}

get fun getGiverData(): (address, address?, address, address, address) {
    loadData();

    return (
        walletAddress,
        marketAddress,
        foundryAddress,
        defiTreasuryAddress
    );
}