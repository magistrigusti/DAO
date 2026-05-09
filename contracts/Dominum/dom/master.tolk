import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// MASTER DOM
// =====================================================
// Master минтит DOM и распределяет mint между 4 активными гиверами.
// GiverManager не меняет адреса внутри гиверов.
// GiverManager только шлет запрос:
// oldGiverAddress -> newGiverAddress.
// Master сам подтверждает, что oldGiverAddress сейчас активный.
// =====================================================

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

    totalSupply = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    lastMintTime = ds.loadUint(64);
    isStarted = ds.loadBool();

    gasPoolAddress = ds.loadAddress();
    giverManagerAddress = ds.loadAddress();

    var giversFirst = ds.loadRef().beginParse();
    var giversSecond = ds.loadRef().beginParse();

    giverAllodiumAddress = giversFirst.loadAddress();
    giverDefiAddress = giversFirst.loadAddress();

    giverDaoAddress = giversSecond.loadAddress();
    giverDominumAddress = giversSecond.loadAddress();

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

    contract.setData(
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

    if (oldGiverAddress == giverDaoAddress) {
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

    return blockchain.now() >= lastMintTime + MINT_INTERVAL;
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
    queryId: int,
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

    var amountDominum =
        amount - amountAllodium - amountDefi - amountDao;

    var tonPer = msgValue / GIVERS_COUNT;
    var tonRemainder = msgValue - tonPer * GIVERS_COUNT;

    sendToWallet(
        giverAllodiumAddress,
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
        assert(amount <= MAX_MINT_AMOUNT, ERROR_LIMIT_EXCEEDED);
        assert(canMintInternal(), ERROR_TOO_EARLY);

        var requiredTon = MIN_TON_FOR_TRANSFER * GIVERS_COUNT;
        assert(msgValue >= requiredTon, ERROR_INSUFFICIENT_GAS);

        if (!isStarted) {
            isStarted = true;
        }

        lastMintTime = blockchain.now();

        mintJettons(
            amount,
            queryId,
            msgValue
        );

        saveData();
        return;
    }

    if (op == OP_BURN_NOTIFICATION) {
        var burnAmount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();

        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromOwner)
        );

        assert(senderAddress == expectedWallet, ERROR_NOT_VALID_WALLET);
        assert(totalSupply >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

        totalSupply = totalSupply - burnAmount;
        saveData();

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

get fun getWalletAddress(ownerAddress: address): address {
    loadData();

    return calculateWalletAddress(
        calculateWalletStateInit(ownerAddress)
    );
}

get fun getMasterData(): (address, address, address, int, int, bool) {
    loadData();

    var nextMintTime = 0;

    if (isStarted) {
        nextMintTime = lastMintTime + MINT_INTERVAL;
    }

    return (
        ownerAddress,
        gasPoolAddress,
        giverManagerAddress,
        lastMintTime,
        nextMintTime,
        isStarted
    );
}

get fun getMintRules(): (int, int, int) {
    return (
        MIN_MINT_AMOUNT,
        MAX_MINT_AMOUNT,
        MINT_INTERVAL
    );
}

get fun canMintNow(): bool {
    loadData();

    return canMintInternal();
}

get fun getGiversData(): (address, address, address, address) {
    loadData();

    return (
        giverAllodiumAddress,
        giverDefiAddress,
        giverDaoAddress,
        giverDominumAddress
    );
}
