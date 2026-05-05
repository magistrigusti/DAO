import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;
global jettonWalletCode: cell;

global pendingTransfers: cell;

fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();

    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();
    if ((bitsLeft > 0) | (refsLeft > 0)) {
        pendingTransfers = ds.loadDict();
    } else {
        pendingTransfers = beginCell().endCell();
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

fun setPendingTransfer(queryId: int, totalSpend: int) {
    var value = beginCell()
        .storeCoins(totalSpend)
        .endCell()
        .beginParse();

    pendingTransfers = pendingTransfers.udictSet(64, queryId, value);
}

fun getPendingTransfer(queryId: int): (int, bool) {
    var (value, found) = pendingTransfers.udictGet(64, queryId);
    if (!found) {
        return (0, false);
    }

    return (value.loadCoins(), true);
}

fun deletePendingTransfer(queryId: int) {
    var (newDict, deleted) = pendingTransfers.udictDelete(64, queryId);
    if (deleted) {
        pendingTransfers = newDict;
    }
}

fun tryClearSettledPending(queryId: int, senderAddress: address) {
    if (senderAddress != gasPoolAddress) {
        return;
    }

    if (queryId < 2) {
        return;
    }

    var originalQueryId = queryId - 2;
    var (_, found) = getPendingTransfer(originalQueryId);

    if (found) {
        deletePendingTransfer(originalQueryId);
    }
}

fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: address): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUnit(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        wc,
        stateInit.hash()
    );
}

fun requireInternalSender(
    senderAddress: address,
    fromOwner: address
) {
    if (senderAddress == masterAddress) {
        return;
    }

    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );

    assert(senderAddress == expectedWallet, ERROR_NOT_VALID_WALLET);
}

fun notifyOwner(
    amount: int;
    fromOwner: address,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}