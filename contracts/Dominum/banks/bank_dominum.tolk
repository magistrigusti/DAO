import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";
global ownerAddress: address;
global gasPoolAddress: address;
global domWalletAddress: address;
global walletConfigured: bool;
global whitelistDict: dict;
global whitelistCount: int;
fun loadData() {
    var ds = contract.getData().beginParse();
    ownerAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    domWalletAddress = ds.loadAddress();
    walletConfigured = ds.loadBool();
    whitelistCount = ds.loadUint(16);
    whitelistDict = ds.loadDict();
}
fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(gasPoolAddress)
            .storeAddress(domWalletAddress)
            .storeBool(walletConfigured)
            .storeUint(whitelistCount, 16)
            .storeDict(whitelistDict)
            .endCell()
    );
}
fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}
fun requireSameWorkchain(candidate: address) {
    assert(
        candidate.getWorkchain() == contract.getAddress().getWorkchain(),
        ERROR_WRONG_TARGET
    );
}
fun initializeWallet(newWalletAddress: address) {
    assert(!walletConfigured, ERROR_ALREADY_INITIALIZED);
    assert(whitelistCount == 0, ERROR_ALREADY_INITIALIZED);
    assert(whitelistDict.dictIsEmpty(), ERROR_ALREADY_INITIALIZED);
    assert(newWalletAddress != domWalletAddress, ERROR_INVALID_AMOUNT);
    assert(newWalletAddress != ownerAddress, ERROR_INVALID_AMOUNT);
    assert(newWalletAddress != gasPoolAddress, ERROR_INVALID_AMOUNT);
    assert(
        newWalletAddress != contract.getAddress(),
        ERROR_INVALID_AMOUNT
    );
    assert(
        newWalletAddress.getWorkchain() ==
        contract.getAddress().getWorkchain(),
        ERROR_WRONG_TARGET
    );
    domWalletAddress = newWalletAddress;
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
    if (candidate == gasPoolAddress) {
        return true;
    }
    return isWhitelisted(candidate);
}
fun sendGrams(toAddress: address, amount: int, queryId: int) {
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
fun withdrawDomJettons(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }
    var transferBody = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(ownerAddress)
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(domWalletAddress)
        .storeCoins(MIN_GRAMS_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(transferBody)
        .endCell();
    sendRawMessage(msg, 1);
}
fun withdrawFromGasPool(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_WITHDRAW_DOM, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}
fun refillGasPool(gramsAmount: int, queryId: int) {
    if (gramsAmount <= 0) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_TOP_UP, 32)
        .storeUint(queryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(gramsAmount)
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
    var msgValue = in.valueCoins;
    var myBalance = contract.getOriginalBalance();
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
            senderAddress == domWalletAddress,
            ERROR_NOT_VALID_WALLET
        );
        return;
    }
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);
        assert(
            amount + MIN_GRAMS_FOR_STORAGE <= myBalance,
            ERROR_INSUFFICIENT_BALANCE
        );
        sendGrams(toAddress, amount, queryId);
        return;
    }
    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);
        assert(
            msgValue >= MIN_GRAMS_FOR_TRANSFER,
            ERROR_INSUFFICIENT_GAS
        );
        withdrawDomJettons(toAddress, amount, queryId);
        return;
    }
    if (op == OP_WITHDRAW_FROM_POOL) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var toAddress = msgBody.loadAddress();
        var amount = msgBody.loadCoins();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isAllowedTarget(toAddress), ERROR_NOT_IN_WHITELIST);
        assert(
            msgValue >= MIN_GRAMS_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );
        withdrawFromGasPool(toAddress, amount, queryId);
        return;
    }
    if (op == OP_REFILL_POOL) {
        requireOwner(senderAddress);
        assert(walletConfigured, ERROR_PROXY_NOT_CONFIGURED);
        var gramsAmount = msgBody.loadCoins();
        assert(gramsAmount > 0, ERROR_INVALID_AMOUNT);
        assert(
            msgValue >= gramsAmount + MIN_GRAMS_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );
        refillGasPool(gramsAmount, queryId);
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
get fun getBankDominumData(): (
    address, address, address, int, int, bool
) {
    loadData();
    return (
        ownerAddress,
        gasPoolAddress,
        domWalletAddress,
        whitelistCount,
        contract.getOriginalBalance(),
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
