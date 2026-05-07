import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: address;
global walletAddress: address;
global realeseAddress: address;

global totalReceived: int;
global totalLocked: int;
global totalUnlocked: int;

global lockBuckets: cell;

fun loadData() {
    var ds = contract.getData().beginParce();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
    realeaseAddress = ds.loadAddress();

    var stats = ds.loadRef().beginParse();
    totalReceived = stats.loadCoins();
    totalLocked = stats.loadCoins();
    lockBuckets = stats.loadDict();
}

fun saveData() {
    var stats = beginCell()
        .storeCoins(totalReceived)
        .storeCoins(totalLocked)
        .storeCoins(totalUnlocked)
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

fun currentMonth(): int {
    return blockchain.now() / SECONDS_PER_MONTH;
}

fun getBucket(month: int): (int, bool) {
    var (value, found) = lockBuckets.udictGet(64, month);
    if (!found) {
        return (0, false);
    }
    return (value.loadCoins(), true);
}

fun setBucket(month: int, amount: int) {
    var value = beginCell()
        .storeCoins(amount)
        .endCell()
        .beginParse();

    lockBuckets = lockBuckets.undictSet(64, month, value);
}

fun deleteBucket(month: int) {
    var (newDict, deleted) = lockBuckets.udictDelete(64, month);
    if (deleted) {
        lockBuckets = newDict;
    }
}

fun lockIncoming(amount: int) {
    var unlockMonth = currentMonth() + LOCK_MONTHS;
    var (oldAmount, _) = getBucket(unlockMonth);

    setBucket(unlockMonth, oldAmount + amount);

    totalReceived += amount;
    totalLocked += amount;
}