import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";
global ownerAddress: address;
global walletAddress: address;
global walletConfigured: bool;
global defiFoundationAddress: address;
global marketMakerAddress: address;
global totalReceived: int;
global totalSent: int;
global whitelistDict: dict;
global whitelistCount: int;
fun loadData() {
    var ds = contract.getData().beginParse();
    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
    walletConfigured = ds.loadBool();
    var targets = ds.loadRef().beginParse();
    defiFoundationAddress = targets.loadAddress();
    marketMakerAddress = targets.loadAddress();
    whitelistCount = targets.loadUint(16);
    var statsRef = ds.loadRef().beginParse();
    totalReceived = statsRef.loadCoins();
    totalSent = statsRef.loadCoins();
    whitelistDict = statsRef.loadDict();
}
fun saveData() {
    var targets = beginCell()
        .storeAddress(defiFoundationAddress)
        .storeAddress(marketMakerAddress)
        .storeUint(whitelistCount, 16)
        .endCell();
    var statsRef = beginCell()
        .storeCoins(totalReceived)
        .storeCoins(totalSent)
        .storeDict(whitelistDict)
        .endCell();
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(walletAddress)
            .storeBool(walletConfigured)
            .storeRef(targets)
            .storeRef(statsRef)
            .endCell()
    );
}
fun requireOwner(senderAddress: address) {
    assert(
        senderAddress == ownerAddress,
        ERROR_NOT_OWNER
    );
}
fun requireSameWorkchain(candidate: address) {
    assert(
        candidate.getWorkchain() == contract.getAddress().getWorkchain(),
        ERROR_WRONG_TARGET
    );
}
fun initializeWallet(newWalletAddress: address) {
    assert(!walletConfigured, ERROR_ALREADY_INITIALIZED);
    assert(totalReceived == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSent == 0, ERROR_ALREADY_INITIALIZED);
    assert(whitelistCount == 0, ERROR_ALREADY_INITIALIZED);
    assert(whitelistDict.dictIsEmpty(), ERROR_ALREADY_INITIALIZED);
    assert(newWalletAddress != walletAddress, ERROR_INVALID_AMOUNT);
    assert(newWalletAddress != ownerAddress, ERROR_INVALID_AMOUNT);
    assert(
        newWalletAddress != defiFoundationAddress,
        ERROR_INVALID_AMOUNT
    );
    assert(
        newWalletAddress != marketMakerAddress,
        ERROR_INVALID_AMOUNT
    );
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
fun getAddrHash(addr: address): int {
    var (_, hash) = addr.getWorkchainAndHash();
    return hash;
}
fun isWhitelisted(addr: address): bool {
    if (
        addr.getWorkchain() !=
        contract.getAddress().getWorkchain()
    ) {
        return false;
    }
    var hash = getAddrHash(addr);
    var (_, found) = whitelistDict.uDictGet(256, hash);
    if (found) {
        return true;
    }
    return false;
}
fun isAllowedTarget(candidate: address): bool {
    if (candidate == defiFoundationAddress) {
        return true;
    }
    if (candidate == marketMakerAddress) {
        return true;
    }
    return isWhitelisted(candidate);
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
fun sendGrams(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;
    if (msgBody.isEmpty()) {
        return;
    }
    var senderAddress = in.senderAddress;
    loadData();
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    if (op == OP_INIT_WALLET_CONFIG) {
        requireOwner(senderAddress);
        initializeWallet(msgBody.loadAddress());
        return;
    }
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        assert(
            senderAddress == walletAddress,
            ERROR_NOT_VALID_WALLET
        );
        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();
        if (fromAddress == contract.getAddress()) {
            return;
        }
        totalReceived = totalReceived + amount;
        saveData();
        return;
    }
    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );
        totalSent = totalSent + amount;
        saveData();
        sendDom(toAddress, amount, queryId);
        return;
    }
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );
        sendGrams(toAddress, amount, queryId);
        return;
    }
    if (op == OP_ADD_WHITELIST) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var newAddress = msgBody.loadAddress();
        requireSameWorkchain(newAddress);
        var hash = getAddrHash(newAddress);
        var (_, exists) = whitelistDict.uDictGet(256, hash);
        if (!exists) {
            var addrSlice = beginCell()
                .storeAddress(newAddress)
                .endCell()
                .beginParse();
            whitelistDict.uDictSet(
                256,
                hash,
                addrSlice
            );
            whitelistCount = whitelistCount + 1;
            saveData();
        }
        return;
    }
    if (op == OP_REMOVE_WHITELIST) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var removeAddress = msgBody.loadAddress();
        requireSameWorkchain(removeAddress);
        var hash = getAddrHash(removeAddress);
        var deleted = whitelistDict.uDictDelete(256, hash);
        if (deleted) {
            whitelistCount = whitelistCount - 1;
            saveData();
        }
        return;
    }
    throw(0xffff);
}
get fun getDefiBankData(): (
    address, address, address, address, int, int, int, bool
) {
    loadData();
    return (
        ownerAddress,
        walletAddress,
        defiFoundationAddress,
        marketMakerAddress,
        whitelistCount,
        totalReceived,
        totalSent,
        walletConfigured
    );
}
get fun isAddressWhitelisted(candidate: address): bool {
    loadData();
    return isWhitelisted(candidate);
}
get fun isAddressAllowed(candidate: address): bool {
    loadData();
    return isAllowedTarget(candidate);
}
