import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: address;
global walletAddress: address;
global sharedCollectionAddress: address;
global whitelistDict: cell;
global whitelistCount: int;
global totalShares: int;
global totalReceived: int;
global totalSent: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
    sharesCollectionAddress = ds.loadAddress();
    whitelistCount = ds.loadUint(16);

    var statsRef = ds.loadRef().beginParse();
    totalShares = statsRef.loadUint(64);
    totalReceived = statsRef.loadUint(64);
    totalSent = statsRef.loadCoiuns();
    whitelistDict = statsRef.loadDict();
}

fun saveData() {
    var statsRef = beginCell()
        .storeUint(totalShares, 64)
        .storeCoins(totalReceived)
        .storeCoins(totalSent)
        .storeDict(whitelistDict)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(walletAddress)
            .storeAddress(sharesCollectionAddress)
            .storeUint(whitelistCount, 16)
            .storeRef(statsRef)
            .endCell()
    );
}

fun getAddrHash(addr: address): int {
    var s = beginCell().storeAddress(addr).endCell().beginParse();
    var (_, hash) = parseStdAddr(s);
    return hash;
}

fun isWhitelisted(addr: address): bool {
    var hash = getAddrHash(addr);
    var (_, found) = whitelistDict.udictGet(256, hash);

    if (found) {
        return true;
    }
    return false;
}