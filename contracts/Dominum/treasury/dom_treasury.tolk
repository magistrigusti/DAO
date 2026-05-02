import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// DOM TREASURY — казна налогов DOM.
// ========================================
// Принимает DOM-комиссию от gas_pool через свой wallet.
// Отправляет DOM/TON только на 3 зашитых адреса банков:
//   - Bank DAO
//   - Bank DeFi
//   - Bank Dominum
//
// Админа нет. Owner зашит при деплое.
// Динамического whitelist нет.
// ========================================

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global ownerAddress: address;
global jettonWalletAddress: address;

global bankDaoAddress: address;
global bankDefiAddress: address;
global bankDominumAddress: address;

global totalReceived: int;
global totalSent: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    jettonWalletAddress = ds.loadAddress();

    bankDaoAddress = ds.loadAddress();
    bankDefiAddress = ds.loadAddress();
    bankDominumAddress = ds.loadAddress();

    totalReceived = ds.loadCoins();
    totalSent = ds.loadCoins();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(jettonWalletAddress)
            .storeAddress(bankDaoAddress)
            .storeAddress(bankDefiAddress)
            .storeAddress(bankDominumAddress)
            .storeCoins(totalReceived)
            .storeCoins(totalSent)
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

fun isAllowedTarget(candidate: address): bool {
    if (candidate == bankDaoAddress) {
        return true;
    }

    if (candidate == bankDefiAddress) {
        return true;
    }

    if (candidate == bankDominumAddress) {
        return true;
    }

    return false;
}

// -----------------------------------------------------
// ВЫВОД TON
// -----------------------------------------------------
fun withdrawTon(
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
// ВЫВОД DOM ЧЕРЕЗ JETTON WALLET (формат v2)
// -----------------------------------------------------
// OP_TRANSFER body:
//   queryId | amount | toOwner | responseDestination | maxFeeDom
// После op/queryId wallet читает:
//   amount | toOwner | responseDestination | maxFeeDom
// -----------------------------------------------------
fun withdrawDom(
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
        .storeAddress(jettonWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
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

    // ВАЖНО:
    // В @ton/tolk-js 1.3.0 у InMessage нет поля isBounced.
    // Поэтому bounce-обработку здесь пока не ставим.
    // Если сообщение отскочит, TON вернётся на уровень VM,
    // а DOM-логика не должна запускаться.
    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM-комиссию
    // Только от treasury jetton wallet.
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress == jettonWalletAddress,
            ERROR_NOT_VALID_WALLET
        );

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        // Рефанд от gas_pool после нашего же вывода.
        // Не считаем как новый доход казны.
        if (fromAddress == contract.getAddress()) {
            return;
        }

        totalReceived = totalReceived + amount;
        saveData();

        return;
    }

    // =====================================================
    // OP_WITHDRAW — вывести TON (owner only, fixed targets)
    // body: amount | toAddress
    // =====================================================
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        withdrawTon(toAddress, amount, queryId);
        return;
    }

    // =====================================================
    // OP_WITHDRAW_JETTONS — вывести DOM (owner only, targets)
    // body: amount | toAddress
    // =====================================================
    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            isAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );

        totalSent = totalSent + amount;
        saveData();

        withdrawDom(toAddress, amount, queryId);
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getTreasuryData(): (
    address, address, address, address, address, int, int, int
) {
    loadData();

    return (
        ownerAddress,
        jettonWalletAddress,
        bankDaoAddress,
        bankDefiAddress,
        bankDominumAddress,
        contract.getOriginalBalance(),
        totalReceived,
        totalSent
    );
}

get fun isAddressWhitelisted(candidate: address): bool {
    loadData();
    return isAllowedTarget(candidate);
}