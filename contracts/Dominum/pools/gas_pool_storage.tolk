import "../core/constants.tolk";
import "../core/errors.tolk";
import "@stdlib/tvm-dicts";

global treasuryPoolAddress: address;
global masterAddress: address;
global jettonWalletCode: cell;
global masterConfigured: bool;
global taxMultiplier: int;
global totalReceivedDom: int;
global totalSpentNanograms: int;
global totalExecuted: int;
global pendingExecutions: dict;

fun gasPoolLoadData() {
    var ds = contract.getData().beginParse();
    treasuryPoolAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
    masterConfigured = ds.loadBool();
    taxMultiplier = ds.loadUint(16);
    totalReceivedDom = ds.loadCoins();
    totalSpentNanograms = ds.loadCoins();
    totalExecuted = ds.loadUint(64);
    var (bitsLeft, refsLeft) = ds.remainingBitsAndRefsCount();
    if ((bitsLeft > 0) | (refsLeft > 0)) {
        pendingExecutions = ds.loadDict();
    } else {
        pendingExecutions = createEmptyDict();
    }
}

fun gasPoolSaveData() {
    contract.setData(
        beginCell()
            .storeAddress(treasuryPoolAddress)
            .storeAddress(masterAddress)
            .storeRef(jettonWalletCode)
            .storeBool(masterConfigured)
            .storeUint(taxMultiplier, 16)
            .storeCoins(totalReceivedDom)
            .storeCoins(totalSpentNanograms)
            .storeUint(totalExecuted, 64)
            .storeDict(pendingExecutions)
            .endCell()
    );
}

fun gasPoolRequireTreasury(senderAddress: address) {
    assert(senderAddress == treasuryPoolAddress, ERROR_NOT_OWNER);
}

fun gasPoolRequireMasterConfigured() {
    assert(masterConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun gasPoolInitMasterConfig(
    newMasterAddress: address,
    newWalletCode: cell
) {
    assert(!masterConfigured, ERROR_ALREADY_INITIALIZED);
    assert(totalReceivedDom == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSpentNanograms == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalExecuted == 0, ERROR_ALREADY_INITIALIZED);
    masterAddress = newMasterAddress;
    jettonWalletCode = newWalletCode;
    masterConfigured = true;
    gasPoolSaveData();
}

fun gasPoolWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(treasuryPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun gasPoolWalletStateInit(owner: address): cell {
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(gasPoolWalletData(owner))
        .storeUint(0, 1)
        .endCell();
}

fun gasPoolWalletAddress(owner: address): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(
        wc,
        gasPoolWalletStateInit(owner).hash()
    );
}

fun gasPoolCalculateFee(): int {
    var feeDom = DOM_TRANSFER_GRAMS_BASE *
        INITIAL_DOM_PER_GRAM *
        taxMultiplier /
        NANOGRAMS_PER_GRAM /
        TAX_MULTIPLIER_DENOM;
    if (feeDom < MIN_DOM_TRANSFER_FEE) {
        feeDom = MIN_DOM_TRANSFER_FEE;
    }
    if (feeDom > MAX_DOM_TRANSFER_FEE) {
        feeDom = MAX_DOM_TRANSFER_FEE;
    }
    return feeDom;
}

fun gasPoolWriteExecution(
    routeId: int,
    fee: int,
    state: int
) {
    var value = beginCell()
        .storeCoins(fee)
        .storeUint(state, 8)
        .endCell()
        .beginParse();
    pendingExecutions.uDictSet(64, routeId, value);
}

fun gasPoolReadExecution(routeId: int): (int, int, bool) {
    var (value, found) = pendingExecutions.uDictGet(64, routeId);
    if (!found) {
        return (0, 0, false);
    }
    var valueSlice = value!;
    var fee = valueSlice.loadCoins();
    var state = valueSlice.loadUint(8);
    return (fee, state, true);
}

fun gasPoolDeleteExecution(routeId: int) {
    pendingExecutions.uDictDelete(64, routeId);
}
