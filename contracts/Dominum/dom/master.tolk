import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global totalSupply: int;
global ownerAddress: address;
global lastMintTime: int;
global isStarted: bool;

global gasPoolAddress: address;
global giverManagerAddress: address;

global giverAllodiumAddress: address;
global giverDefiAddress: address;
global giverDaoAddress: address;
global giverDominumAddress: address;

global content: cell;
global jettonWalletCode: cell;

fun loadData() {
    var ds = contract.getData().beginParse();

    totalSupply = ds.loadCoiuns();
    ownerAddress = ds.loadAddress();
    lastMintTime = ds.loadUint(64);
    isStarted = ds.loadBool();

    gaspoolAddress = ds.loadAddress();
    giverManagerAddress = ds.loadAddress();

    var giversFirst = ds.loadRef().beginParse();
    var giverSecond = ds.loadRef().beginParse();

    giverAllodiumAddress = giversFirst.loadAddress();
    giverDefiAddress = giversFirst.loadAddress();

    giverDaoAddress = giverSecond.loadAddress();
    giverDominumAddress = giverSecond.loadAddress();

    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    var giversFirst = beginCell()
        .storeAddress(giverAllodiumAddress)
        .storeAddress(giverDefiAddress)
        .endCell();

    var giversSecond = beginCell()
        .storeAddress(giverDaoAddress)
        .storeAddress(giverDominumAddress)
        .endCell();

    constract.setData(
        beginCell()
            .storeCoins(totalSupply)
            .storeAddress(ownerAddress)
            .storeUint(lastMintTime, 64)
            .storeBool(isStarted)
            .storeAddress(gasPoolAddress)
            .storeAddress(giverManagerAddress)
            .storeRef(giversFirst)
            .storeRef(giversSecond)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
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
    var wc = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        wc,
        stateInit.hash()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun requireGiverManager(senderAddress: address) {
    assert(senderAddress == giverManagerAddress, ERROR_NOT_MANAGER);
}

fun replaceGiverAddress(
    oldGiverAddress: address,
    newGiverAddress: address
) {
    if (oldGiverAddress == giverAllodiumAddress) {
        giverAllodiumAddress = newGiverAddress;
        return;
    }

    if (oldGiverAddress == giverDefiAddress) {
        giverDefiAddress = newGiverAddress;
        return;
    }

    if (oldGiverAddress == giverDoaAddress) {
        giverDaoAddress = newGiverAddress;
        return;
    }

    if (oldGiverAddress == giverDominumAddress) {
        giverDominumAddress = newGiverAddress;
        return;
    }

    throw(ERROR_NOT_IN_WHITELIST);
}

fun canMintInternal(): bool {
    if (!isStarted) {
        return true;
    }

    return blockchain.now() >= lastMintTime + MINT_INTERNAL;
}

fun sendToWallet(
    toOwner: address,
    jettonAmount: int,
    queryId: int,
    msgValue: int
) {
    var stateInit = calculateWalletStateInit(toOwner);
    var walletAddress = calculateWalletAddress(stateInit);

    var msgBody = beginCell()
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
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

fun mintJettons(
    amount: int,
    quryId: int,
    msgValue: int
) {
    assert(
        SHARE_ALLODIUM + SHARE_DEFI + SHARE_DAO + SHARE_DOMINUM == 100,
        ERROR_INVALID_AMOUNT
    );

    assert(totalSupply + amount <= MAX_SUPPLY, ERROR_LIMIT_EXCEEDED);

    totalSupply = totalSupply + amount;

    var amountAllodium = amount * SHARE_ALLODIUM / 100;
    var amountDefi = amount * SHARE_DEFI / 100;
    var amountDao = amount * SHARE_DAO / 100;

    var amountDominum = amount - amountAllodium - amountDefi - amountDao;

    var tonPer = msgValue /GIVERS_COUNT;
    var tonRemainder = msgValue - tonPer * GIVERS_COUNT;

    sendToWallet(
        giverAlodiumAddress,
        amountAllodium,
        queryId,
        tonPer + tonRemainder
    );

    sendToWallet(
        giverDefiAddress,
        amountDefi,
        queryId + 1,
        tonPer
    );

    sendToWallet(
        giverDaoAddress,
        amountDao,
        queryId + 2,
        tonPer
    );

    sendToWallet(
        giverDominumAddress,
        amountDominum,
        queryId + 3,
        tonPer
    );
}

fun onInternalMessage(id: InMessage) {
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
        requireGiverManager(senderAddress);

        var oldGiverAddress = msgBody.loadAddress();
        var newGiverAddress = msgBody.loadAddress();

        replaceGiverAddress(
            oldGiverAddress,
            newGiverAddress
        );

        saveData();
        return;
    }

    if (op == OP_MINT) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();

        assert(amount >= MIN_MINT_AMOUNT, ERROR_INVALID_AMOUNT);
    }
}