// =====================================================
// GIVER ALLODIUM — Автораспределение DOM для Allodium
// =====================================================
// При получении жетонов:
// • 50% -> FRS Allodium
// • 50% -> Allodium Foundation
// Manager может:
// • менять whitelist
// • выставлять walletAddress
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

// =====================================================
// STORAGE
// =====================================================
global managerAddress: address;
global walletAddress: address?;
global frsAllodiumAddress: address;
global allodiumFoundationAddress: address;

// =====================================================
// LOAD / SAVE
// =====================================================
fun loadData() {
    var ds = contract.getData().beginParse();

    managerAddress = ds.loadAddress();
    walletAddress = ds.loadAddressOpt();

    var targets = ds.loadRef().beginParse();
    frsAllodiumAddress = targets.loadAddress();
    allodiumFoundationAddress = targets.loadAddress();
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(frsAllodiumAddress)
        .storeAddress(allodiumFoundationAddress)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(managerAddress)
            .storeAddressOpt(walletAddress)
            .storeRef(targets)
            .endCell()
    );
}

fun sendJettons(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    assert(walletAddress != null, ERROR_NOT_VALID_WALLET);

    var currentWalletAddress = walletAddress!;

    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(toAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(currentWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

fun autoDistribute(amount: int, queryId: int) {
    var feeTotal = TAX_AMOUNT + TAX_HALF;

    var half = amount / 2;
    var remainder = amount - half;

    assert(half > feeTotal, ERROR_INVALID_AMOUNT);
    assert(remainder > feeTotal, ERROR_INVALID_AMOUNT);

    sendJettons(frsAllodiumAddress, half - feeTotal, queryId);
    sendJettons(allodiumFoundationAddress, remainder - feeTotal, queryId + 1);
}

// =====================================================
// MAIN
// =====================================================
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
        assert(
            walletAddress != null,
            ERROR_NOT_VALID_WALLET
        );

        assert(
            senderAddress == walletAddress!,
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        msgBody.loadAddress();
        autoDistribute(amount, queryId);
        return;
    }

    // =====================================================
    // OP_SET_WALLET — только Manager
    // payload: walletAddress
    // =====================================================
    if (op == OP_SET_WALLET) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );

        var newWalletAddress = msgBody.loadAddress();
        walletAddress = newWalletAddress;
        saveData();
        return;
    }

    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );

        var newAddress1 = msgBody.loadAddress();
        var newAddress2 = msgBody.loadAddress();

        frsAllodiumAddress = newAddress1;
        allodiumFoundationAddress = newAddress2;
        saveData();

        return;
    }

    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================
get fun getGiverData(): (address, address?, address, address) {
    loadData();
    return (
        managerAddress,
        walletAddress,
        frsAllodiumAddress,
        allodiumFoundationAddress
    );
}