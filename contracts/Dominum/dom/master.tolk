import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// MASTER DOM
// =====================================================
// Mint разрешён только от текущего Minter.
// MinterManager может заменить Minter только через проверку old -> new.
// GiverManager может заменить активный Giver только через проверку old -> new.
// Получатели внутри гиверов не меняются никогда.
// =====================================================

global totalSupply: int;
global ownerAddress: address;
global lastMintTime: int;
global isStarted: bool;

global treasuryPoolAddress: address;

global minterAddress: address;
global minterManagerAddress: address;
global giverManagerAddress: address;

global giverAllodiumAddress: address;
global giverDefiAddress: address;
global giverDaoAddress: address;
global giverDominumAddress: address;

global hasPendingMasterRequest: bool;
global pendingMasterRequestKind: int;
global pendingMasterTargetKind: int;
global pendingMasterOldAddress: address?;
global pendingMasterNewAddress: address?;

global content: cell;
global jettonWalletCode: cell;

fun loadData() {
    var ds = contract.getData().beginParse();

    totalSupply = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    lastMintTime = ds.loadUint(64);
    isStarted = ds.loadBool();

    var roles = ds.loadRef().beginParse();
    var roleCore = roles.loadRef().beginParse();
    var roleManagers = roles.loadRef().beginParse();

    treasuryPoolAddress = roleCore.loadAddress();
    minterAddress = roleCore.loadAddress();

    minterManagerAddress = roleManagers.loadAddress();
    giverManagerAddress = roleManagers.loadAddress();

    var givers = ds.loadRef().beginParse();
    var giversFirst = givers.loadRef().beginParse();
    var giversSecond = givers.loadRef().beginParse();

    giverAllodiumAddress = giversFirst.loadAddress();
    giverDefiAddress = giversFirst.loadAddress();

    giverDaoAddress = giversSecond.loadAddress();
    giverDominumAddress = giversSecond.loadAddress();

    var pending = ds.loadRef().beginParse();
    hasPendingMasterRequest = pending.loadBool();
    pendingMasterRequestKind = pending.loadUint(8);
    pendingMasterTargetKind = pending.loadUint(8);
    pendingMasterOldAddress = pending.loadAddressOpt();
    pendingMasterNewAddress = pending.loadAddressOpt();

    var metadataAndCode = ds.loadRef().beginParse();
    content = metadataAndCode.loadRef();
    jettonWalletCode = metadataAndCode.loadRef();
}

fun saveData() {
    var roleCore = beginCell()
        .storeAddress(treasuryPoolAddress)
        .storeAddress(minterAddress)
        .endCell();

    var roleManagers = beginCell()
        .storeAddress(minterManagerAddress)
        .storeAddress(giverManagerAddress)
        .endCell();

    var roles = beginCell()
        .storeRef(roleCore)
        .storeRef(roleManagers)
        .endCell();

    var giversFirst = beginCell()
        .storeAddress(giverAllodiumAddress)
        .storeAddress(giverDefiAddress)
        .endCell();

    var giversSecond = beginCell()
        .storeAddress(giverDaoAddress)
        .storeAddress(giverDominumAddress)
        .endCell();

    var givers = beginCell()
        .storeRef(giversFirst)
        .storeRef(giversSecond)
        .endCell();

    var pending = beginCell()
        .storeBool(hasPendingMasterRequest)
        .storeUint(pendingMasterRequestKind, 8)
        .storeUint(pendingMasterTargetKind, 8)
        .storeAddressOpt(pendingMasterOldAddress)
        .storeAddressOpt(pendingMasterNewAddress)
        .endCell();

    var metadataAndCode = beginCell()
        .storeRef(content)
        .storeRef(jettonWalletCode)
        .endCell();

    contract.setData(
        beginCell()
            .storeCoins(totalSupply)
            .storeAddress(ownerAddress)
            .storeUint(lastMintTime, 64)
            .storeBool(isStarted)
            .storeRef(roles)
            .storeRef(givers)
            .storeRef(pending)
            .storeRef(metadataAndCode)
            .endCell()
    );
}

fun calculateWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(contract.getAddress())
        .storeAddress(treasuryPoolAddress)
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

fun requireMinter(senderAddress: address) {
    assert(senderAddress == minterAddress, ERROR_NOT_MINTER);
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun requireMinterManager(senderAddress: address) {
    assert(senderAddress == minterManagerAddress, ERROR_NOT_MANAGER);
}

fun requireGiverManager(senderAddress: address) {
    assert(senderAddress == giverManagerAddress, ERROR_NOT_MANAGER);
}

fun clearMasterRequest() {
    hasPendingMasterRequest = false;
    pendingMasterRequestKind = MASTER_REQUEST_NONE;
    pendingMasterTargetKind = 0;
    pendingMasterOldAddress = null;
    pendingMasterNewAddress = null;
}

fun createMasterRequest(
    requestKind: int,
    targetKind: int,
    oldAddress: address,
    newAddress: address
) {
    assert(!hasPendingMasterRequest, ERROR_ALREADY_INITIALIZED);
    assert(oldAddress != newAddress, ERROR_INVALID_AMOUNT);

    hasPendingMasterRequest = true;
    pendingMasterRequestKind = requestKind;
    pendingMasterTargetKind = targetKind;
    pendingMasterOldAddress = oldAddress;
    pendingMasterNewAddress = newAddress;
}

fun applyGiverChange(
    targetKind: int,
    oldAddress: address,
    newAddress: address
) {
    if (targetKind == GIVER_TARGET_ALLODIUM) {
        assert(oldAddress == giverAllodiumAddress, ERROR_NOT_IN_WHITELIST);
        giverAllodiumAddress = newAddress;
        return;
    }

    if (targetKind == GIVER_TARGET_DEFI) {
        assert(oldAddress == giverDefiAddress, ERROR_NOT_IN_WHITELIST);
        giverDefiAddress = newAddress;
        return;
    }

    if (targetKind == GIVER_TARGET_DAO) {
        assert(oldAddress == giverDaoAddress, ERROR_NOT_IN_WHITELIST);
        giverDaoAddress = newAddress;
        return;
    }

    if (targetKind == GIVER_TARGET_DOMINUM) {
        assert(oldAddress == giverDominumAddress, ERROR_NOT_IN_WHITELIST);
        giverDominumAddress = newAddress;
        return;
    }

    throw(ERROR_WRONG_TARGET);
}

fun applyMasterRequest() {
    assert(hasPendingMasterRequest, ERROR_NO_PENDING);
    assert(pendingMasterOldAddress != null, ERROR_NO_PENDING);
    assert(pendingMasterNewAddress != null, ERROR_NO_PENDING);

    var oldAddress = pendingMasterOldAddress!;
    var newAddress = pendingMasterNewAddress!;

    if (pendingMasterRequestKind == MASTER_REQUEST_MINTER) {
        assert(oldAddress == minterAddress, ERROR_NOT_MINTER);
        minterAddress = newAddress;
        return;
    }

    if (pendingMasterRequestKind == MASTER_REQUEST_GIVER) {
        applyGiverChange(
            pendingMasterTargetKind,
            oldAddress,
            newAddress
        );
        return;
    }

    if (pendingMasterRequestKind == MASTER_REQUEST_MINTER_MANAGER) {
        assert(
            pendingMasterTargetKind == MANAGER_TARGET_MINTER,
            ERROR_WRONG_TARGET
        );
        assert(oldAddress == minterManagerAddress, ERROR_NOT_MANAGER);
        minterManagerAddress = newAddress;
        return;
    }

    if (pendingMasterRequestKind == MASTER_REQUEST_GIVER_MANAGER) {
        assert(
            pendingMasterTargetKind == MANAGER_TARGET_GIVER,
            ERROR_WRONG_TARGET
        );
        assert(oldAddress == giverManagerAddress, ERROR_NOT_MANAGER);
        giverManagerAddress = newAddress;
        return;
    }

    throw(ERROR_WRONG_TARGET);
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

    sendToWallet(giverAllodiumAddress, amountAllodium, queryId, tonPer + tonRemainder);
    sendToWallet(giverDefiAddress, amountDefi, queryId + 1, tonPer);
    sendToWallet(giverDaoAddress, amountDao, queryId + 2, tonPer);
    sendToWallet(giverDominumAddress, amountDominum, queryId + 3, tonPer);
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
        requireMinter(senderAddress);
        assert(!hasPendingMasterRequest, ERROR_ALREADY_INITIALIZED);

        var amount = msgBody.loadCoins();

        assert(amount >= MIN_MINT_AMOUNT, ERROR_INVALID_AMOUNT);
        assert(amount <= MAX_MINT_AMOUNT, ERROR_LIMIT_EXCEEDED);
        assert(canMintInternal(), ERROR_TOO_EARLY);

        var requiredGrams = MIN_GRAMS_FOR_TRANSFER * GIVERS_COUNT;
        assert(msgValue >= requiredGrams, ERROR_INSUFFICIENT_GAS);

        if (!isStarted) {
            isStarted = true;
        }

        lastMintTime = blockchain.now();

        mintJettons(amount, queryId, msgValue);
        saveData();
        return;
    }

    if (op == OP_REPLACE_MINTER) {
        requireMinterManager(senderAddress);

        var oldMinterAddress = msgBody.loadAddress();
        var newMinterAddress = msgBody.loadAddress();

        assert(oldMinterAddress == minterAddress, ERROR_NOT_MINTER);

        createMasterRequest(
            MASTER_REQUEST_MINTER,
            0,
            oldMinterAddress,
            newMinterAddress
        );

        saveData();
        return;
    }

    if (op == OP_REPLACE_GIVER) {
        requireGiverManager(senderAddress);

        var targetKind = msgBody.loadUint(8);
        var oldGiverAddress = msgBody.loadAddress();
        var newGiverAddress = msgBody.loadAddress();

        if (targetKind == GIVER_TARGET_ALLODIUM) {
            assert(
                oldGiverAddress == giverAllodiumAddress,
                ERROR_NOT_IN_WHITELIST
            );
        } else if (targetKind == GIVER_TARGET_DEFI) {
            assert(
                oldGiverAddress == giverDefiAddress,
                ERROR_NOT_IN_WHITELIST
            );
        } else if (targetKind == GIVER_TARGET_DAO) {
            assert(
                oldGiverAddress == giverDaoAddress,
                ERROR_NOT_IN_WHITELIST
            );
        } else if (targetKind == GIVER_TARGET_DOMINUM) {
            assert(
                oldGiverAddress == giverDominumAddress,
                ERROR_NOT_IN_WHITELIST
            );
        } else {
            throw(ERROR_WRONG_TARGET);
        }

        createMasterRequest(
            MASTER_REQUEST_GIVER,
            targetKind,
            oldGiverAddress,
            newGiverAddress
        );

        saveData();
        return;
    }

    if (op == OP_REPLACE_MANAGER) {
        var targetKind = msgBody.loadUint(8);
        var oldManagerAddress = msgBody.loadAddress();
        var newManagerAddress = msgBody.loadAddress();

        if (targetKind == MANAGER_TARGET_MINTER) {
            requireMinterManager(senderAddress);
            assert(
                oldManagerAddress == minterManagerAddress,
                ERROR_NOT_MANAGER
            );
            createMasterRequest(
                MASTER_REQUEST_MINTER_MANAGER,
                targetKind,
                oldManagerAddress,
                newManagerAddress
            );
            saveData();
            return;
        }

        if (targetKind == MANAGER_TARGET_GIVER) {
            requireGiverManager(senderAddress);
            assert(
                oldManagerAddress == giverManagerAddress,
                ERROR_NOT_MANAGER
            );
            createMasterRequest(
                MASTER_REQUEST_GIVER_MANAGER,
                targetKind,
                oldManagerAddress,
                newManagerAddress
            );
            saveData();
            return;
        }

        throw(ERROR_WRONG_TARGET);
    }

    if (op == OP_CONFIRM_MASTER_REQUEST) {
        requireOwner(senderAddress);
        applyMasterRequest();
        clearMasterRequest();
        saveData();
        return;
    }

    if (op == OP_REJECT_MASTER_REQUEST) {
        requireOwner(senderAddress);
        assert(hasPendingMasterRequest, ERROR_NO_PENDING);
        clearMasterRequest();
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

get fun getMasterData(): (
    address,
    address,
    address,
    address,
    address,
    int,
    int,
    bool
) {
    loadData();

    var nextMintTime = 0;

    if (isStarted) {
        nextMintTime = lastMintTime + MINT_INTERVAL;
    }

    return (
        ownerAddress,
        treasuryPoolAddress,
        minterAddress,
        minterManagerAddress,
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

get fun getMasterPendingRequest(): (
    bool, int, int, address?, address?
) {
    loadData();

    return (
        hasPendingMasterRequest,
        pendingMasterRequestKind,
        pendingMasterTargetKind,
        pendingMasterOldAddress,
        pendingMasterNewAddress
    );
}
