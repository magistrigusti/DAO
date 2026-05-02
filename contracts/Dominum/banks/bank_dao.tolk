import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// BANK DAO — казначейский банк DAO-ветки.
// ========================================
// Принимает DOM от Giver DAO.
// Хранит DOM на своём jetton wallet.
// Отправляет DOM/TON только на whitelist.
//
// ВАЖНО:
// Банк НЕ выпускает облигации и NFT.
// Для этого позже будет отдельный контракт:
//   contracts/Dominum/dao/bond_issuer.tolk
//
// Банк только финансирует такие контракты через whitelist.
// ========================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global ownerAddress: address;
global walletAddress: address;
global whitelistDict: cell;
global whitelistCount: int;

// Статистика
global totalReceived: int;
global totalSent: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
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
        .storeCoins(totalSent)
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

// -----------------------------------------------------
// SERVICE
// -----------------------------------------------------
fun requireOwner(senderAddress: address) {
    assert(
        senderAddress == ownerAddress,
        ERROR_NOT_OWNER
    );
}

// -----------------------------------------------------
// WHITELIST HELPERS
// -----------------------------------------------------
fun getAddrHash(addr: address): int {
    var s = beginCell()
        .storeAddress(addr)
        .endCell()
        .beginParse();

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

// -----------------------------------------------------
// ОТПРАВКА DOM ЧЕРЕЗ СВОЙ WALLET
// -----------------------------------------------------
// Новый формат OP_TRANSFER v2:
// amount | toOwner | responseDestination | maxFeeDom
// -----------------------------------------------------
fun sendDom(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// ОТПРАВКА TON
// -----------------------------------------------------
fun sendTon(
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

// -----------------------------------------------------
// ОТПРАВКА ПРОИЗВОЛЬНОЙ КОМАНДЫ НА WHITELIST
// -----------------------------------------------------
fun sendCommand(
    toAddress: address,
    tonAmount: int,
    payload: cell
) {
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(toAddress)
        .storeCoins(tonAmount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(payload)
        .endCell();

    sendRawMessage(msg, 1);
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

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // Только от своего jetton wallet.
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress == walletAddress,
            ERROR_NOT_VALID_WALLET
        );

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        // Рефанд от gas_pool после нашего вывода.
        // Это возврат части комиссии, статистику прихода не раздуваем.
        if (fromAddress == contract.getAddress()) {
            return;
        }

        totalReceived = totalReceived + amount;
        saveData();

        return;
    }

    // =====================================================
    // OP_WITHDRAW_JETTONS — вывести DOM (owner, whitelist)
    // body: amount | toAddress
    // =====================================================
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

    // =====================================================
    // OP_WITHDRAW — вывести TON (owner, whitelist)
    // body: amount | toAddress
    // =====================================================
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendTon(toAddress, amount, queryId);
        return;
    }

    // =====================================================
    // OP_SEND_JETTONS — команда дочернему контракту
    // body: toAddress | tonAmount | payload(ref)
    // =====================================================
    if (op == OP_SEND_JETTONS) {
        requireOwner(senderAddress);

        var toAddress = msgBody.loadAddress();
        var tonAmount = msgBody.loadCoins();
        var payload = msgBody.loadRef();

        assert(
            isWhitelisted(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        sendCommand(toAddress, tonAmount, payload);
        return;
    }

    // =====================================================
    // OP_ADD_WHITELIST — добавить адрес (owner only)
    // =====================================================
    if (op == OP_ADD_WHITELIST) {
        requireOwner(senderAddress);

        var newAddress = msgBody.loadAddress();
        var hash = getAddrHash(newAddress);

        var (_, exists) = whitelistDict.udictGet(256, hash);

        if (!exists) {
            var addrSlice = beginCell()
                .storeAddress(newAddress)
                .endCell()
                .beginParse();

            whitelistDict = whitelistDict.udictSet(
                256,
                hash,
                addrSlice
            );

            whitelistCount = whitelistCount + 1;
            saveData();
        }

        return;
    }

    // =====================================================
    // OP_REMOVE_WHITELIST — убрать адрес (owner only)
    // =====================================================
    if (op == OP_REMOVE_WHITELIST) {
        requireOwner(senderAddress);

        var removeAddress = msgBody.loadAddress();
        var hash = getAddrHash(removeAddress);

        var (newDict, deleted) = whitelistDict
            .udictDelete(256, hash);

        if (deleted) {
            whitelistDict = newDict;
            whitelistCount = whitelistCount - 1;
            saveData();
        }

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getBankData(): (
    address, address, int, int, int
) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        whitelistCount,
        totalReceived,
        totalSent
    );
}

get fun getDaoBankData(): (
    address, address, int, int, int
) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        whitelistCount,
        totalReceived,
        totalSent
    );
}

get fun isAddressWhitelisted(addr: address): bool {
    loadData();
    return isWhitelisted(addr);
}