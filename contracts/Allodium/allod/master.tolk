import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global totalSupply: int;

global ownerAddress: address;
global frsAddress: address;
global frsConfigured: bool;
global gasPoolAddress: address;

global mintAllowancePool: int;

global content: cell;
global jettonWalletCode: cell;

fun loadData() {
    var ds = contract.getData().beginParse();

    totalSupply = ds.loadCoins();

    ownerAddress = ds.loadAddress();
    frsAddress = ds.loadAddress();
    frsConfigured = ds.loadBool();
    gasPoolAddress = ds.loadAddress();

    mintAllowancePool = ds.loadCoins();

    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(totalSupply)
            .storeAddress(ownerAddress)
            .storeAddress(frsAddress)
            .storeBool(frsConfigured)
            .storeAddress(gasPoolAddress)
            .storeCoins(mintAllowancePool)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

fun requireFrsConfigured() {
    assert(frsConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun initializeFrs(newFrsAddress: address) {
    assert(!frsConfigured, ERROR_ALREADY_INITIALIZED);
    assert(totalSupply == 0, ERROR_ALREADY_INITIALIZED);
    assert(mintAllowancePool == 0, ERROR_ALREADY_INITIALIZED);
    assert(newFrsAddress != ownerAddress, ERROR_INVALID_AMOUNT);
    assert(newFrsAddress != gasPoolAddress, ERROR_INVALID_AMOUNT);
    assert(newFrsAddress != contract.getAddress(), ERROR_INVALID_AMOUNT);
    assert(
        newFrsAddress.getWorkchain() ==
        contract.getAddress().getWorkchain(),
        ERROR_INVALID_AMOUNT
    );
    frsAddress = newFrsAddress;
    frsConfigured = true;
    saveData();
}

fun calculateWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(contract.getAddress())
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun calculateWalletStateInit(owner: address): cell {
    var walletData = calculateWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun calculateWalletAddress(stateInit: cell): address {
    var workchain = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        workchain,
        stateInit.hash()
    );
}

fun sendToWallet(
    toOwner: address,
    jettonAmount: int,
    queryId: int,
    msgValue: int
) {
    var stateInit = calculateWalletStateInit(toOwner);
    var walletAddress = calculateWalletAddress(stateInit);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(contract.getAddress())
        .storeAddress(toOwner)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendAllodBurnedToFrs(burnAmount: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_ALLOD_BURNED, 32)
        .storeUint(queryId, 64)
        .storeCoins(burnAmount)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(frsAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
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

    if (op == OP_INIT_MASTER_FRS_CONFIG) {
        assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
        initializeFrs(msgBody.loadAddress());
        return;
    }

    if (op == OP_INCREASE_MINT_ALLOWANCE) {
        requireFrsConfigured();
        assert(
            senderAddress == frsAddress,
            ERROR_NOT_FRS
        );

        var allowanceAmount = msgBody.loadCoins();
        assert(allowanceAmount > 0, ERROR_INVALID_AMOUNT);

        mintAllowancePool = mintAllowancePool
            + allowanceAmount;

        saveData();
        return;
    }

    if (op == OP_MINT) {
        requireFrsConfigured();
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var toOwner = msgBody.loadAddress();
        var mintAmount = msgBody.loadCoins();

        assert(mintAmount > 0, ERROR_INVALID_AMOUNT);
        assert(
            mintAmount <= mintAllowancePool,
            ERROR_LIMIT_EXCEEDED
        );
        assert(
            msgValue >= MIN_GRAMS_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );

        mintAllowancePool = mintAllowancePool - mintAmount;
        totalSupply = totalSupply + mintAmount;
        saveData();

        sendToWallet(
            toOwner,
            mintAmount,
            queryId,
            msgValue
        );

        return;
    }

    if (op == OP_BURN_NOTIFICATION) {
        requireFrsConfigured();
        var burnAmount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();

        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromOwner)
        );

        assert(
            senderAddress == expectedWallet,
            ERROR_NOT_VALID_WALLET
        );

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(totalSupply >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

        totalSupply = totalSupply - burnAmount;
        saveData();

        sendAllodBurnedToFrs(burnAmount, queryId);

        var responseAddress = msgBody.loadAddressOpt();

        if (responseAddress != null) {
            var msg = beginCell()
                .storeUint(0x10, 6)
                .storeAddress(responseAddress)
                .storeCoins(0)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeUint(OP_EXCESSES, 32)
                .storeUint(queryId, 64)
                .endCell();

            sendRawMessage(msg, 64 + 2);
        }

        return;
    }

    throw(0xffff);
}

get fun getJettonData(): (int, int, address, cell, cell) {
    loadData();

    return (
        totalSupply,
        -1,
        ownerAddress,
        content,
        jettonWalletCode
    );
}

get fun getWalletAddress(ownerAddressValue: address): address {
    loadData();

    var stateInit = calculateWalletStateInit(ownerAddressValue);
    return calculateWalletAddress(stateInit);
}

get fun getMasterData(): (address, address, bool, address, int, int) {
    loadData();

    return (
        ownerAddress,
        frsAddress,
        frsConfigured,
        gasPoolAddress,
        mintAllowancePool,
        totalSupply
    );
}
