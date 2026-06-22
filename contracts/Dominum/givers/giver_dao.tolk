import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// GIVER DAO
// Автоматический сепаратор DOM.
// Никаких manager/admin внутри нет.
// Адреса получателей задаются при деплое и не меняются.

global masterAddress: address;
global gasRouterAddress: address;
global jettonWalletCode: cell;

global bankDaoAddress: address;
global daoFoundationAddress: address;

fun loadData() {
    var ds = contract.getData().beginParse();

    masterAddress = ds.loadAddress();
    gasRouterAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();

    var targets = ds.loadRef().beginParse();

    bankDaoAddress = targets.loadAddress();
    daoFoundationAddress = targets.loadAddress();
}

fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(gasRouterAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: address): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(owner: address): address {
    var stateInit = buildWalletStateInit(owner);
    var workchain = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        workchain,
        stateInit.hash()
    );
}

fun sendJettons(toAddress: address, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var walletAddress = buildWalletAddress(contract.getAddress());

    var body = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun autoDistribute(amount: int, queryId: int) {
    var feeReserve = GIVER_MAX_FEE_DOM * 2;

    assert(amount > feeReserve, ERROR_INVALID_AMOUNT);

    var distributable = amount - feeReserve;

    var bankPart = distributable / 2;
    var foundationPart = distributable - bankPart;

    sendJettons(bankDaoAddress, bankPart, queryId);
    sendJettons(daoFoundationAddress, foundationPart, queryId + 1);
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
        var expectedWallet = buildWalletAddress(contract.getAddress());

        assert(senderAddress == expectedWallet, ERROR_NOT_VALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        autoDistribute(amount, queryId);
        return;
    }

    throw(0xffff);
}

get fun getGiverData(): (
    address,
    address,
    address,
    address,
    address
) {
    loadData();

    return (
        masterAddress,
        gasRouterAddress,
        buildWalletAddress(contract.getAddress()),
        bankDaoAddress,
        daoFoundationAddress
    );
}
