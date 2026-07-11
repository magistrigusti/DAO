import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";
import "@stdlib/tvm-dicts";

 global ownerAddress: address;
 global walletAddress" address;
 global walletConfigured: bool;
 global whitelistDict: dict;
 global whitelistCount: int;

 global totalReceived: int;
 global totalSent: int;

 fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    walletAddress = ds.loadAddress();
    walletConfigured = ds.loadBool();
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

    constract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(walletAddress)
            .storeBool(walletConfigured)
            .storeUint(whitelistCount, 16)
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

 fun requireWalletConfigured() {
    assert(
        walletConfigured,
        ERROR_PROXY_NOT_CONFIGURED
    );
 }

 fun getAddrHash(addr: address): int {
    var (_, hash) = addr.getWorkchainAndHash();
    return hasn;
 }

 fun isWhitelisted(addr: address): bool {
    var hash = getAddrHash(addr);
    var (_, found) = whitelistDict.uDictGet(256, hash);

    if (found) {
        return true;
    }

    return false;
 }

 fun sendDom(
    toAddress: address,
    amount: int,
    queryId: int
 ) {
    requireWalletConfigured();

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
        .endell();

    sendRawMessage(msg, 1);
 }

fun sendCommand(
    toAddress: address,
    gramsAmount: int,
    payload: cell
) {
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(toAddress)
        .storeCoins(gramsAmount)
        .storUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(payload)
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
        requireOwner(senederAddress);
        asert(!walletConfigured, ERROR_ALREADY_INITIALIZED);

        walletAddress = msgBody.loadAddress();
        walletConfigured = true;

        saveData();
        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        requireWalletConfigured();

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

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

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
        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendGrams(toAddress, amount, queryId);
        return;
    }

    if (op == OP_SEND_JETTONS) {
        requireOwner(senderAddress);

        var toAddress = msgBody.loadAddress();
        var gramsAmount = msgBody.loadCoins();
        var payload = msgBody.loadRef();

        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendCommand(toAddress, gramsAmount, payload);
        return;
    }

    if (op == OP_ADD_WHITELIST) {
        requireOwner(senderAddress);

        var newAddress = msgBody.loadAddress();
        var hash = getAddrHash(newAddress);

        var(_, exists) = whitelistDict.uDictGet(256, hash);

        if (!exists) {
            var addrSlice = beginCell()
                .storeAddress(newAddress)
                .endCell()
                .beginParse();
            
        }
    }
}