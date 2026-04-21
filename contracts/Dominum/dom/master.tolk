import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// MASTER v2:
// - минт только ownerAddress (без отдельного minter)
// - первый минт сразу после деплоя
// - дальше через MINT_INTERVAL от прошлого минта
// - распределение через 4 givers по долям из constants.tolk
//
// Master шлёт OP_INTERNAL_TRANSFER (mint → giver-wallet),
// не OP_TRANSFER. Юзерский формат v2 здесь не используется.
// =========================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global totalSupply: int;
global ownerAddress: address;
global lastMintTime: int;
global isStarted: bool;
global gasPoolAddress: address;
global giverAllodiumAddress: address;
global giverDefiAddress: address;
global giverDaoAddress: address;
global giverDominumAddress: address;
global content: cell;
global jettonWalletCode: cell;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    totalSupply = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    lastMintTime = ds.loadUint(64);
    isStarted = ds.loadBool();
    gasPoolAddress = ds.loadAddress();

    var giversFirst = ds.loadRef().beginParse();
    var giversSecond = ds.loadRef().beginParse();
    giverAllodiumAddress = giversFirst.loadAddress();
    giverDefiAddress = giversFirst.loadAddress();
    giverDaoAddress = giversSecond.loadAddress();
    giverDominumAddress = giversSecond.loadAddress();

    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    var giversFirst = beginCell()
        .storeAddress(giverAllodiumAddress)
        .storeAddress(giverDefiAddress)
        .endCell();

    var giversSecond = beginCell()
        .storeAddress(giverDaoAddress)
        .storeAddress(giverDominumAddress)
        .endCell();

    contract.setData(
        beginCell()
            .storeCoins(totalSupply)
            .storeAddress(ownerAddress)
            .storeUint(lastMintTime, 64)
            .storeBool(isStarted)
            .storeAddress(gasPoolAddress)
            .storeRef(giversFirst)
            .storeRef(giversSecond)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS (детерминированный расчёт)
// -----------------------------------------------------
fun calculateWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(contract.getAddress())
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun calculateWalletStateInit(owner: address): cell {
    var walletData = calculateWalletData(owner);
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun calculateWalletAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(wc, stateInit.hash());
}

// -----------------------------------------------------
// SERVICE
// -----------------------------------------------------
fun requireOwner(senderAddress: address) {
    assert(senderAddress == ownerAddress, ERROR_NOT_OWNER);
}

fun canMintInternal(): bool {
    if (!isStarted) {
        return true;
    }
    return blockchain.now() >= lastMintTime + MINT_INTERVAL;
}

// -----------------------------------------------------
// MINT SEND — отправка DOM в wallet одного гивера.
// Формат тела OP_INTERNAL_TRANSFER совместим с wallet.tolk
// (amount | fromOwner=master | responseDest=toOwner | ...)
// -----------------------------------------------------
fun sendToWallet(
    toOwner: address,
    jettonAmount: int,
    queryId: int,
    msgValue: int
) {
    var stateInit = calculateWalletStateInit(toOwner);
    var walletAddress = calculateWalletAddress(stateInit);

    var msgBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(contract.getAddress())
        .storeAddress(toOwner)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MINT DISTRIBUTION — делим DOM на 4 giver'а по долям
// -----------------------------------------------------
fun mintJettons(amount: int, queryId: int, msgValue: int) {
    assert(
        SHARE_ALLODIUM + SHARE_DEFI + SHARE_DAO + SHARE_DOMINUM == 100,
        ERROR_INVALID_AMOUNT
    );
    assert(totalSupply + amount <= MAX_SUPPLY, ERROR_LIMIT_EXCEEDED);

    totalSupply = totalSupply + amount;

    var amountAllodium = amount * SHARE_ALLODIUM / 100;
    var amountDefi = amount * SHARE_DEFI / 100;
    var amountDao = amount * SHARE_DAO / 100;

    // Остаток → Dominum (избегаем потерь от округления)
    var amountDominum = amount - amountAllodium - amountDefi - amountDao;

    // TON делим на GIVERS_COUNT, остаток кладём в первое сообщение
    var tonPer = msgValue / GIVERS_COUNT;
    var tonRemainder = msgValue - tonPer * GIVERS_COUNT;

    sendToWallet(giverAllodiumAddress, amountAllodium, queryId, tonPer + tonRemainder);
    sendToWallet(giverDefiAddress, amountDefi, queryId + 1, tonPer);
    sendToWallet(giverDaoAddress, amountDao, queryId + 2, tonPer);
    sendToWallet(giverDominumAddress, amountDominum, queryId + 3, tonPer);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;
    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_MINT — только owner, с учётом MINT_INTERVAL
    // =====================================================
    if (op == OP_MINT) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        assert(amount >= MIN_MINT_AMOUNT, ERROR_INVALID_AMOUNT);
        assert(amount <= MAX_MINT_AMOUNT, ERROR_LIMIT_EXCEEDED);
        assert(canMintInternal(), ERROR_TOO_EARLY);

        var requiredTon = MIN_TON_FOR_TRANSFER * GIVERS_COUNT;
        assert(msgValue >= requiredTon, ERROR_INSUFFICIENT_GAS);

        if (!isStarted) {
            isStarted = true;
        }
        lastMintTime = blockchain.now();

        mintJettons(amount, queryId, msgValue);
        saveData();
        return;
    }

    // =====================================================
    // OP_BURN_NOTIFICATION — от wallet после OP_BURN
    // =====================================================
    if (op == OP_BURN_NOTIFICATION) {
        var burnAmount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();

        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromOwner)
        );
        assert(senderAddress == expectedWallet, ERROR_NOT_VALID_WALLET);
        assert(totalSupply >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

        totalSupply = totalSupply - burnAmount;
        saveData();

        var responseAddress = msgBody.loadAddressOpt();
        if (responseAddress != null) {
            var msg = beginCell()
                .storeUint(0x10, 6)
                .storeAddress(responseAddress)
                .storeCoins(0)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeUint(OP_EXCESSES, 32)
                .storeUint(queryId, 64)
                .endCell();
            sendRawMessage(msg, 64 + 2);
        }
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getJettonData(): (int, int, address, cell, cell) {
    loadData();
    return (totalSupply, -1, ownerAddress, content, jettonWalletCode);
}

get fun getWalletAddress(ownerAddress: address): address {
    loadData();
    return calculateWalletAddress(calculateWalletStateInit(ownerAddress));
}

get fun getMasterData(): (address, address, int, int, bool) {
    loadData();
    var nextMintTime = 0;
    if (isStarted) {
        nextMintTime = lastMintTime + MINT_INTERVAL;
    }
    return (ownerAddress, gasPoolAddress, lastMintTime, nextMintTime, isStarted);
}

get fun getMintRules(): (int, int, int) {
    return (MIN_MINT_AMOUNT, MAX_MINT_AMOUNT, MINT_INTERVAL);
}

get fun canMintNow(): bool {
    loadData();
    return canMintInternal();
}

get fun getGiversData(): (address, address, address, address) {
    loadData();
    return (
        giverAllodiumAddress,
        giverDefiAddress,
        giverDaoAddress,
        giverDominumAddress
    );
}
