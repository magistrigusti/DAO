import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: address;
global walletAddress: address;
global whitelistDict: cell;
global whitelistCount: intl

global totalReceived: int;
global totalSent: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
    whitelistCount = ds.loadUint(16);

    var statsRef = ds.loadRef().beginParse();
    totalReceived = statsRef.loadCoins();
    totalSent = statsRef.loadCoins();
    whitelistDict = statsRef.loadDict();
}

fun saveData() {
    var statsRef = beginCell()
        .storeCoins(totalReceived)
        .storeCoins(totalSend)
        .storeDict(whitelistDict)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(walletAddress)
            .storeUint(whitelistCount, 16)
            .storeRef(statsRef)
            .endCell()
    );
}

fun getAddHash(addr: address): int {
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

fun sendDom(toAddress: address, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress
}
