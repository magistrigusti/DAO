import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

// ========== FOUNDRY LOCK ==========
// Контракт принимает DOM на свой jetton wallet.
//
// Каждый входящий mint блокируется отдельно по месяцу
// будущей разблокировки:
//
// unlockMonth = currentMonth() + LOCK_MONTHS
//
// Владелец может разблокировать bucket только после срока.
// Если попытаться раньше, контракт упадет с ERROR_TOO_EARLY.
// ==================================

global ownerAddress: address;
global walletAddress: address;
global releaseAddress: address;

global totalReceived: int;
global totalLocked: int;
global totalUnlocked: int;
global totalFeePaid: int;
global totalReturnedFee: int;

global lockBuckets: dict;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
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
            .storeAddress(releaseAddress)
            .storeRef(stats)
            .endCell()
    );
}

// -----------------------------------------------------
// ACCESS
// -----------------------------------------------------
fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

// -----------------------------------------------------
// TIME
// -----------------------------------------------------
fun currentMonth(): int {
    return blockchain.now() / SECONDS_PER_MONTH;
}

fun getUnlockMonth(): int {
    return currentMonth() + LOCK_MONTHS;
}

// -----------------------------------------------------
// BUCKETS
// -----------------------------------------------------
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

// -----------------------------------------------------
// LOCK
// -----------------------------------------------------
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

// -----------------------------------------------------
// RETURNED FEE
// -----------------------------------------------------
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

// -----------------------------------------------------
// SEND DOM
// -----------------------------------------------------
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

// -----------------------------------------------------
// UNLOCK
// -----------------------------------------------------
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

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
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

    if (op == OP_TRANSFER_NOTIFICATION) {
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

        var month = msgBody.loadUint(64);

        unlockMonth(
            month,
            queryId
        );

        return;
    }

    if (op == OP_SET_RELEASE) {
        requireOwner(senderAddress);

        releaseAddress = msgBody.loadAddress();

        saveData();
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getFoundryLockData(): (
    address,
    address,
    address,
    int,
    int,
    int,
    int,
    int,
    int
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
        currentMonth()
    );
}

get fun getLockedBucket(month: int): (int, bool) {
    loadData();

    return readBucket(month);
}

get fun getNextUnlockMonth(): int {
    return getUnlockMonth();
}
