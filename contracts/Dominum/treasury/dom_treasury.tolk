import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

// =====================================================
// DOM TREASURY — Единое казначейство Dominum
// =====================================================
// Принимает: налог от Gas Pool
// Отправляет: ТОЛЬКО на банки (whitelist)
// Управляется: СИД-фраза владельца
// Админа НЕТ — адреса жёстко зашиты при деплое!
// =====================================================

global ownerAddress: address;
global jettonWalletAddress: address;

// Whitelist — 3 банка (ЖЁСТКО при деплое!)
global bankDaoAddress: address;
global bankDefiAddress: address;
global bankDominumAddress: address;

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
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeAddress(jettonWalletAddress)
            .storeAddress(bankDaoAddress)
            .storeAddress(bankDefiAddress)
            .storeAddress(bankDominumAddress)
            .endCell()
    );
}

// -----------------------------------------------------
// ПРОВЕРКА WHITELIST
// -----------------------------------------------------

fun isWhitelisted(candidate: address): bool {
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

fun withdrawTon(toAddress: address, amount: int, queryId: int) {
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
// ВЫВОД DOM (через Jetton Wallet)
// -----------------------------------------------------

fun withdrawDom(toAddress: address, amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(ownerAddress)
        .storeBool(false)                // no custom_payload
        .storeCoins(0)                   // forward_ton_amount
        .storeBool(false)                // no forward_payload
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(jettonWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    // Пустое сообщение — просто принимаем TON
    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM (налог)
    // Принимать можно только от treasury jetton wallet
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(senderAddress == jettonWalletAddress, ERROR_NOT_VALID_WALLET);
        return;
    }

    // =====================================================
    // OP_WITHDRAW — вывести TON (только owner, только whitelist)
    // =====================================================
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        // ТОЛЬКО НА БАНКИ!
        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);

        withdrawTon(toAddress, amount, queryId);

        return;
    }

    // =====================================================
    // OP_WITHDRAW_JETTONS — вывести DOM (только owner, только whitelist)
    // =====================================================
    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();

        // ТОЛЬКО НА БАНКИ!
        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);

        withdrawDom(toAddress, amount, queryId);

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getTreasuryData(): (address, address, address, address, address, int) {
    loadData();

    return (
        ownerAddress,
        jettonWalletAddress,
        bankDaoAddress,
        bankDefiAddress,
        bankDominumAddress,
        contract.getOriginalBalance()
    );
}

get fun isAddressWhitelisted(candidate: address): bool {
    loadData();
    return isWhitelisted(candidate);
}