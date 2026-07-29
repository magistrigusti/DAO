import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

global ownerAddress: address;
global walletAddress: address;
global walletConfigured: bool;
global releaseAddress: address;

global totalReceived: int;
global totalLocked: int;
global totalUnlocked: int;
global totalFeePaid: int;
global totalReturnedFee: int;

global lockBuckets: dict;

fun loadData() {
    var ds = contract.getData().beginParse();
    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
    walletConfigured = ds.loadBool();
    releaseAddress = ds.loadAddress();
    var stats = ds.loadRef().beginParse();
    totalReceived = stats.loadCoins();
    totalLocked = stats.loadCoins();
    totalUnlocked = stats.loadCoins();
    totalFeePaid = stats.loadCoins();
    totalReturnedFee = stats.loadCoins();
    lockBuckets = stats.loadDict();
}

fun saveData() {
    var stats = beginCell()
        .storeCoins(totalReceived)
        .storeCoins(totalLocked)
        .storeCoins(totalUnlocked)
        .storeCoins(totalFeePaid)
        .storeCoins(totalReturnedFee)
        .storeDict(lockBuckets)
        .endCell();
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(walletAddress)
            .storeBool(walletConfigured)
            .storeAddress(releaseAddress)
            .storeRef(stats)
            .endCell()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun initializeWallet(newWalletAddress: address) {
    assert(!walletConfigured, ERROR_ALREADY_INITIALIZED);
    assert(totalReceived == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalLocked == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalUnlocked == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalFeePaid == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalReturnedFee == 0, ERROR_ALREADY_INITIALIZED);
    assert(lockBuckets.dictIsEmpty(), ERROR_ALREADY_INITIALIZED);
    assert(newWalletAddress != walletAddress, ERROR_INVALID_AMOUNT);
    assert(newWalletAddress != ownerAddress, ERROR_INVALID_AMOUNT);
    assert(newWalletAddress != releaseAddress, ERROR_INVALID_AMOUNT);
    assert(
        newWalletAddress != contract.getAddress(),
        ERROR_INVALID_AMOUNT
    );
    assert(
        newWalletAddress.getWorkchain() ==
        contract.getAddress().getWorkchain(),
        ERROR_WRONG_TARGET
    );
    walletAddress = newWalletAddress;
    walletConfigured = true;
    saveData();
}

fun currentMonth(): int {
    return blockchain.now() / SECONDS_PER_MONTH;
}

fun getUnlockMonth(): int {
    return currentMonth() + LOCK_MONTHS;
}

fun readBucket(month: int): (int, bool) {
    var (value, found) = lockBuckets.uDictGet(64, month);
    if (!found) {
        return (0, false);
    }
    var valueSlice = value!;
    return (valueSlice.loadCoins(), true);
}

fun setBucket(month: int, amount: int) {
    var value = beginCell()
        .storeCoins(amount)
        .endCell()
        .beginParse();
    lockBuckets.uDictSet(64, month, value);
}

fun deleteBucket(month: int) {
    lockBuckets.uDictDelete(64, month);
}

fun lockIncoming(amount: int) {
    if (amount <= 0) {
        return;
    }
    var unlockMonth = getUnlockMonth();
    var (oldAmount, _) = readBucket(unlockMonth);
    setBucket(unlockMonth, oldAmount + amount);
    totalReceived = totalReceived + amount;
    totalLocked = totalLocked + amount;
    saveData();
}

fun acceptReturnedFee(amount: int) {
    if (amount <= 0) {
        return;
    }
    totalReturnedFee = totalReturnedFee + amount;
    if (totalFeePaid >= amount) {
        totalFeePaid = totalFeePaid - amount;
    }
    saveData();
}

fun sendDom(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(MIN_GRAMS_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun unlockMonth(
    month: int,
    queryId: int
) {
    assert(month <= currentMonth(), ERROR_TOO_EARLY);

    var (lockedAmount, found) = readBucket(month);

    assert(found, ERROR_NO_PENDING);
    assert(lockedAmount > GIVER_MAX_FEE_DOM, ERROR_INVALID_AMOUNT);

    var releaseAmount = lockedAmount - GIVER_MAX_FEE_DOM;

    deleteBucket(month);

    totalLocked = totalLocked - lockedAmount;
    totalUnlocked = totalUnlocked + releaseAmount;
    totalFeePaid = totalFeePaid + GIVER_MAX_FEE_DOM;

    saveData();

    sendDom(
        releaseAddress,
        releaseAmount,
        queryId
    );
}

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);

    if (op == 0xffffffff) {
        return;
    }

    var queryId = msgBody.loadUint(64);

    if (op == OP_INIT_WALLET_CONFIG) {
        requireOwner(senderAddress);
        initializeWallet(msgBody.loadAddress());
        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        assert(senderAddress == walletAddress, ERROR_NOT_VALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            acceptReturnedFee(amount);
            return;
        }

        lockIncoming(amount);
        return;
    }

    if (op == OP_UNLOCK_MONTH) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);

        var month = msgBody.loadUint(64);

        unlockMonth(
            month,
            queryId
        );

        return;
    }

    if (op == OP_SET_RELEASE) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);

        releaseAddress = msgBody.loadAddress();

        saveData();
        return;
    }

    throw(0xffff);
}

get fun getFoundryLockData(): (
    address,
    address,
    address,
    int,
    int,
    int,
    int,
    int,
    int,
    bool
) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        releaseAddress,
        totalReceived,
        totalLocked,
        totalUnlocked,
        totalFeePaid,
        totalReturnedFee,
        currentMonth(),
        walletConfigured
    );
}

get fun getLockedBucket(month: int): (int, bool) {
    loadData();

    return readBucket(month);
}

get fun getNextUnlockMonth(): int {
    return getUnlockMonth();
}
