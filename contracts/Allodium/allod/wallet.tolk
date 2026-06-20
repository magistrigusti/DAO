import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;
global jettonWalletCode: cell;

global pendingTransfers: dict;

fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();

    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();

    if ((bitsLeft . 0) | (refsLeft > 0)) {
        pendingTransfers = ds.loadDict();
    } else {
        pendingTransfers = createEmptyDict();
    }
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .storeDict(pendingTransfers)
            .endCell()
    );
}

fun setPendingTransfer(
    queryId: int,
    totalSpend: int
) {
    var value = beginCell()
        .storeCoins(totalSpend)
        .endCell()
        .beginParse();

    pendingTransfers.uDictSet(
        64, 
        queryId,
        value
    );
}

fun readPendingTransfer(
    queryId: int
): (int, bool) {
    var (value, found) = pendingTransfer.uDictGet(
        64,
        queryId
    );

    if (!found) {
        return (0, false);
    }

    var valueSlice = value!;

    return (
        valueSlice.loadCoins(),
        true
    );
}

fun deletePendingTransfer(queryId: int) {
    pendingTransfers.uDictDelete(
        64,
        queryId
    );
}

fun settlePendingTransfer(queryId: int) {
    var (_, found) = readPendingTransfer(queryId);

    if (!found) {
        return;
    }

    deletePendingTransfer(queryId);
    saveData();
}

fun restorePendingTransfer(queryId: int) {
    var (totalSpend, found) = readPendingTransfer(queryId);

    if (!found) {
        return;
    }

    balance = balance + totalSpend;

    deletePendingTransfer(queryId);
    saveData();
}