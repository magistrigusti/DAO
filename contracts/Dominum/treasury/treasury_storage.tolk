import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

global ownerAddress: address;
global treasuryManagerAddress: address;
global jettonWalletAddress: address;
global walletConfigured: bool;
global bankDaoAddress: address;
global bankDefiAddress: address;
global bankDominumAddress: address;
global gasPoolAddress: address;
global masterAddress: address;
global jettonWalletCode: cell;
global masterConfigured: bool;
global taxMultiplier: int;
global totalReceivedDom: int;
global totalSentDom: int;
global totalSentNanograms: int;
global hasPending: bool;
global pendingKind: int;
global pendingTargetKind: int;
global pendingOldAddress: address?;
global pendingNewAddress: address?;
global pendingOldValue: int;
global pendingNewValue: int;
global nextRouteId: int;
global pendingRoutes: dict;

fun treasuryLoadData() {
    var ds = contract.getData().beginParse();
    ownerAddress = ds.loadAddress();
    treasuryManagerAddress = ds.loadAddress();
    jettonWalletAddress = ds.loadAddress();
    walletConfigured = ds.loadBool();
    var targets = ds.loadRef().beginParse();
    var bankTargets = targets.loadRef().beginParse();
    var poolTargets = targets.loadRef().beginParse();
    bankDaoAddress = bankTargets.loadAddress();
    bankDefiAddress = bankTargets.loadAddress();
    bankDominumAddress = poolTargets.loadAddress();
    gasPoolAddress = poolTargets.loadAddress();
    var stats = ds.loadRef().beginParse();
    taxMultiplier = stats.loadUint(16);
    totalReceivedDom = stats.loadCoins();
    totalSentDom = stats.loadCoins();
    totalSentNanograms = stats.loadCoins();
    var pending = ds.loadRef().beginParse();
    hasPending = pending.loadBool();
    pendingKind = pending.loadUint(8);
    pendingTargetKind = pending.loadUint(8);
    pendingOldAddress = pending.loadAddressOpt();
    pendingNewAddress = pending.loadAddressOpt();
    pendingOldValue = pending.loadUint(32);
    pendingNewValue = pending.loadUint(32);
    var (_, refsLeft) = ds.remainingBitsAndRefsCount();
    if (refsLeft > 0) {
        var extra = ds.loadRef().beginParse();
        var routing = extra.loadRef().beginParse();
        nextRouteId = routing.loadUint(64);
        pendingRoutes = routing.loadDict();
        var masterConfig = extra.loadRef().beginParse();
        masterAddress = masterConfig.loadAddress();
        jettonWalletCode = masterConfig.loadRef();
        masterConfigured = masterConfig.loadBool();
    } else {
        nextRouteId = 1;
        pendingRoutes = createEmptyDict();
        masterAddress = ownerAddress;
        jettonWalletCode = beginCell().endCell();
        masterConfigured = false;
    }
}

fun treasurySaveData() {
    var bankTargets = beginCell()
        .storeAddress(bankDaoAddress)
        .storeAddress(bankDefiAddress)
        .endCell();
    var poolTargets = beginCell()
        .storeAddress(bankDominumAddress)
        .storeAddress(gasPoolAddress)
        .endCell();
    var targets = beginCell()
        .storeRef(bankTargets)
        .storeRef(poolTargets)
        .endCell();
    var stats = beginCell()
        .storeUint(taxMultiplier, 16)
        .storeCoins(totalReceivedDom)
        .storeCoins(totalSentDom)
        .storeCoins(totalSentNanograms)
        .endCell();
    var pending = beginCell()
        .storeBool(hasPending)
        .storeUint(pendingKind, 8)
        .storeUint(pendingTargetKind, 8)
        .storeAddressOpt(pendingOldAddress)
        .storeAddressOpt(pendingNewAddress)
        .storeUint(pendingOldValue, 32)
        .storeUint(pendingNewValue, 32)
        .endCell();
    var routing = beginCell()
        .storeUint(nextRouteId, 64)
        .storeDict(pendingRoutes)
        .endCell();
    var masterConfig = beginCell()
        .storeAddress(masterAddress)
        .storeRef(jettonWalletCode)
        .storeBool(masterConfigured)
        .endCell();
    var extra = beginCell()
        .storeRef(routing)
        .storeRef(masterConfig)
        .endCell();
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(treasuryManagerAddress)
            .storeAddress(jettonWalletAddress)
            .storeBool(walletConfigured)
            .storeRef(targets)
            .storeRef(stats)
            .storeRef(pending)
            .storeRef(extra)
            .endCell()
    );
}

fun treasuryWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(contract.getAddress())
        .storeRef(jettonWalletCode)
        .endCell();
}

fun treasuryWalletStateInit(owner: address): cell {
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(treasuryWalletData(owner))
        .storeUint(0, 1)
        .endCell();
}

fun treasuryWalletAddress(owner: address): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(
        wc,
        treasuryWalletStateInit(owner).hash()
    );
}
