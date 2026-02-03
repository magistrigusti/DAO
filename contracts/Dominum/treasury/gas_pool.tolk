import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global adminAddress: slice;
global domTreasuryAddress: slice;
global masterAddress: slice;
global jettonWalletCode: cell;

global domBalance: int;
global tonReserve: int;

fun loadData() {
    var ds = getContractData().beginParse();

    adminAddress = ds.loadMsgAddress();
    domTreasuryAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
    jettonWalletCode = ds.loadRef();

    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(masterAddress)
            .storeRef(jettonWalletCode)
            .storeCoins(domBalance)
            .storeCoins(tonReserve)
            .endCell()
    );
}

fun buildWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(masterAddress)
        .storeSlice(myAddress())
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

fun sendInternalTransfer(
    toOwner: slice,
    jettonAmount: int,
    fromOwner: slice,
    responseDestination: slice,
    queryId: int,
    msgValue: int
) {
    if (jettonAmount <= 0) {
        return;
    }

    var stateInit = buildWalletSttateInit(toOwner);
    var toWallet = buildWalletAddress(stateInit);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(fromOwner)
        .storeSlice(responseDestination)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toWallet)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendTon(to: slice, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .store
}