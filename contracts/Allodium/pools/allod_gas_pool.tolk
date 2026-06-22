import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global authorityAddress: address;
global masterAddress: address;
global jettonWalletCode: cell;
global masterConfigured: bool;

global transferFeeAllod: int;

global totalReceivedAllod: int;
global totalSpentTon: int;
global totalExecuted: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    authorityAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
    masterConfigured = ds.loadBool();

    transferFeeAllod = ds.loadCoins();

    totalReceivedAllod = ds.loadCoins();
    totalSpentTon = ds.loadCoins();
    totalExecuted = ds.loadUint(64);
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(authorityAddress)
            .storeAddress(masterAddress)
            .storeRef(jettonWalletCode)
            .storeBool(masterConfigured)
            .storeCoins(transferFeeAllod)
            .storeCoins(totalReceivedAllod)
            .storeCoins(totalSpentTon)
            .storeUint(totalExecuted, 64)
            .endCell()
    );
}

fun requireAuthority(senderAddress: address) {
    assert(senderAddress == authorityAddress, ERROR_NOT_OWNER);
}

fun requireMasterConfigured() {
    assert(masterConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(contract.getAddress())
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
    var wc = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        wc,
        stateInit.hash()
    );
}

fun sendInternalTransfer(
    toOwner: address,
    amount: int,
    fromOwner: address,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(toOwner);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeAddress(fromOwner)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(toWallet)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendSettlement(
    walletAddress: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun initMasterConfig(
    newMasterAddress: address,
    newJettonWalletCode: cell
) {
    assert(!masterConfigured, ERROR_ALREADY_INITIALIZED);
    assert(totalReceivedAllod == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSpentTon == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalExecuted == 0, ERROR_ALREADY_INITIALIZED);

    masterAddress = newMasterAddress;
    jettonWalletCode = newJettonWalletCode;
    masterConfigured = true;

    saveData();
}

fun executeTransfer(
    senderWallet: address,
    jettonAmount: int,
    toOwner: address,
    fromOwner: address,
    paidFeeAllod: int,
    queryId: int
) {
    requireMasterConfigured();

    var expectedWallet = buildWalletAddress(fromOwner);
    assert(senderWallet == expectedWallet, ERROR_NOT_VALID_WALLET);

    assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
    assert(paidFeeAllod == transferFeeAllod, ERROR_INVALID_AMOUNT);

    var tonBudget = ALLOD_GAS_TRANSFER_TON_BUDGET;

    assert(
        contract.getOriginalBalance() >= tonBudget + MIN_TON_FOR_STORAGE,
        ERROR_INSUFFICIENT_GAS
    );

    sendInternalTransfer(
        toOwner,
        jettonAmount,
        fromOwner,
        queryId + 1
    );

    sendInternalTransfer(
        contract.getAddress(),
        paidFeeAllod,
        fromOwner,
        queryId + 2
    );

    totalSpentTon = totalSpentTon + tonBudget;
    totalExecuted = totalExecuted + 1;

    saveData();
    sendSettlement(senderWallet, queryId);
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

    if (op == OP_INIT_ALLOD_MASTER_CONFIG) {
        requireAuthority(senderAddress);

        var newMasterAddress = msgBody.loadAddress();
        var newJettonWalletCode = msgBody.loadRef();

        initMasterConfig(
            newMasterAddress,
            newJettonWalletCode
        );

        return;
    }

    if (op == OP_ALLOD_GAS_POOL_EXECUTE) {
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var paidFeeAllod = msgBody.loadCoins();

        executeTransfer(
            senderAddress,
            jettonAmount,
            toOwner,
            fromOwner,
            paidFeeAllod,
            queryId
        );

        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        requireMasterConfigured();

        var poolWallet = buildWalletAddress(contract.getAddress());
        assert(senderAddress == poolWallet, ERROR_NOT_VALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        totalReceivedAllod = totalReceivedAllod + amount;
        saveData();

        return;
    }

    if (op == OP_CHANGE_ALLOD_TRANSFER_FEE) {
        requireAuthority(senderAddress);

        var newTransferFeeAllod = msgBody.loadCoins();

        assert(
            newTransferFeeAllod >= ALLOD_TRANSFER_FEE_MIN,
            ERROR_INVALID_AMOUNT
        );

        assert(
            newTransferFeeAllod <= ALLOD_TRANSFER_FEE_MAX,
            ERROR_LIMIT_EXCEEDED
        );

        transferFeeAllod = newTransferFeeAllod;
        saveData();

        return;
    }

    if (op == OP_ALLOD_GAS_TOP_UP) {
        requireAuthority(senderAddress);
        return;
    }

    throw(0xffff);
}

get fun getAllodGasPoolData(): (
    address,
    address,
    bool,
    int,
    int,
    int,
    int,
    int
) {
    loadData();

    return (
        authorityAddress,
        masterAddress,
        masterConfigured,
        transferFeeAllod,
        totalReceivedAllod,
        totalSpentTon,
        totalExecuted,
        contract.getOriginalBalance()
    );
}

get fun getPoolWalletAddress(): address {
    loadData();
    return buildWalletAddress(contract.getAddress());
}

get fun getWalletAddress(owner: address): address {
    loadData();
    return buildWalletAddress(owner);
}

get fun getAllodTransferFee(): int {
    loadData();
    return transferFeeAllod;
}
