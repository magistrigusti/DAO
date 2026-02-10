import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// MARKET MAKER — Головной контракт рыночных операций
// =====================================================
// Принимает: DOM от Giver DeFi (50% split)
// Хранит: DOM на балансе
// Отправляет: ТОЛЬКО на адреса из whitelist (dict)
//
// Whitelist динамический — owner добавляет/убирает
// адреса контрактов (пулы, продажи, биржи и т.д.)
//
// Потом эти контракты будут управляться нейронками.
// Market Maker — их "банк" и точка входа.
//
// Owner менять НЕЛЬЗЯ (жёстко при деплое).
// =====================================================

global ownerAddress: slice;
global walletAddress: slice;
global whitelistDict: cell;
global whitelistCount: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();

    ownerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
    whitelistCount = ds.loadUint(16);
    whitelistDict = ds.loadDict();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(walletAddress)
            .storeUint(whitelistCount, 16)
            .storeDict(whitelistDict)
            .endCell()
    );
}

// -----------------------------------------------------
// WHITELIST HELPERS
// -----------------------------------------------------

// Получить 256-bit hash из адреса
fun getAddrHash(addr: slice): int {
    var (_, hash) = parseStdAddr(addr);
    return hash;
}

// Проверить есть ли адрес в whitelist
fun isWhitelisted(addr: slice): int {
    var hash = getAddrHash(addr);
    var (_, found) = whitelistDict.udictGet(256, hash);
    return found;
}

// -----------------------------------------------------
// ОТПРАВКА DOM (через Jetton Wallet)
// -----------------------------------------------------

fun sendDom(
    toAddress: slice,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(walletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ОТПРАВКА TON
// -----------------------------------------------------

fun sendTon(
    toAddress: slice,
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
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------

fun onInternalMessage(
    myBalance: int,
    msgValue: int,
    msgFull: cell,
    msgBody: slice
) {
    if (msgBody.isEndOfSlice()) {
        return;
    }

    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);

    if (flags & 1) {
        return;
    }

    var senderAddress = cs.loadMsgAddress();

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // Просто принимаем и храним
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }

    // =====================================================
    // OP_WITHDRAW_JETTONS — отправить DOM (только owner)
    // Только на whitelist адреса!
    // =====================================================
    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendDom(toAddress, amount, queryId);

        return;
    }

    // =====================================================
    // OP_WITHDRAW — отправить TON (только owner)
    // Только на whitelist адреса!
    // =====================================================
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendTon(toAddress, amount, queryId);

        return;
    }

    // =====================================================
    // OP_ADD_WHITELIST — добавить адрес (только owner)
    // =====================================================
    if (op == OP_ADD_WHITELIST) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var newAddress = msgBody.loadMsgAddress();
        var hash = getAddrHash(newAddress);

        // Проверяем что ещё не в whitelist
        var (_, alreadyExists) = whitelistDict
            .udictGet(256, hash);

        if (!alreadyExists) {
            // Сохраняем адрес в значение dict
            // чтобы потом можно было получить
            whitelistDict = whitelistDict.udictSet(
                256,
                hash,
                newAddress
            );

            whitelistCount += 1;
        }

        saveData();

        return;
    }

    // =====================================================
    // OP_REMOVE_WHITELIST — убрать адрес (только owner)
    // =====================================================
    if (op == OP_REMOVE_WHITELIST) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var removeAddress = msgBody.loadMsgAddress();
        var hash = getAddrHash(removeAddress);

        var (newDict, deleted) = whitelistDict
            .udictDelete(256, hash);

        if (deleted) {
            whitelistDict = newDict;
            whitelistCount -= 1;
        }

        saveData();

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getMarketData(): (slice, slice, int) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        whitelistCount
    );
}

get fun isAddressWhitelisted(addr: slice): int {
    loadData();
    return isWhitelisted(addr);
}