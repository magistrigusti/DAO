import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

// ========== TOLK MIGRATION v2 ==========
// ALLODIUM FOUNDATION — фонд ликвидности Allodium.
// Принимает DOM от Giver Allodium и FRS.
// Хранит DOM на своём DOM-wallet.
// Owner зашит при деплое.
// ========================================

const DOM_TRANSFER_MAX_FEE: int = 3000000;

global ownerAddress: address;
global domWalletAddress: address;
global whitelistDict: dict;
global whitelistCount: int;
global totalReceived: int;
global totalSent: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    domWalletAddress = ds.loadAddress();
    whitelistCount = ds.loadUint(16);

    var statsRef = ds.loadRef().beginParse();
    totalReceived = statsRef.loadCoins();
    totalSent = statsRef.loadCoins();
    whitelistDict = statsRef.loadDict();
}

fun saveData() {
    var statsRef = beginCell()
        .storeCoins(totalReceived)
        .storeCoins(totalSent)
        .storeDict(whitelistDict)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(domWalletAddress)
            .storeUint(whitelistCount, 16)
            .storeRef(statsRef)
            .endCell()
    );
}

fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun getAddrHash(addr: address): int {
    var (_, hash) = addr.getWorkchainAndHash();
    return hash;
}

fun isWhitelisted(addr: address): bool {
    var hash = getAddrHash(addr);
    var (_, found) = whitelistDict.uDictGet(256, hash);

    if (found) {
        return true;
    }

    return false;
}

fun sendDom(toAddress: address, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(DOM_TRANSFER_MAX_FEE)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(domWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendTon(toAddress: address, amount: int, queryId: int) {
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(senderAddress == domWalletAddress, ERROR_NOT_VALID_WALLET);

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

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);

        totalSent = totalSent + amount;
        saveData();

        sendDom(toAddress, amount, queryId);
        return;
    }

    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);

        sendTon(toAddress, amount, queryId);
        return;
    }

    if (op == OP_ADD_WHITELIST) {
        requireOwner(senderAddress);

        var newAddress = msgBody.loadAddress();
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

        var removeAddress = msgBody.loadAddress();
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

get fun getFoundationData(): (
    address, address, int, int, int
) {
    loadData();

    return (
        ownerAddress,
        domWalletAddress,
        whitelistCount,
        totalReceived,
        totalSent
    );
}

get fun isAddressWhitelisted(candidate: address): bool {
    loadData();
    return isWhitelisted(candidate);
}

get fun isAddressAllowed(candidate: address): bool {
    loadData();
    return isWhitelisted(candidate);
}
