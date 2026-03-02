// =====================================================
// GIVER MANAGER — Управление гиверами
// =====================================================
// Управляется: СИД-фраза владельца
// Может:
// 1) менять whitelist в гиверах
// 2) выставлять walletAddress в гиверах (OP_SET_WALLET)
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
global ownerAddress: address;

// =====================================================
// LOAD / SAVE
// =====================================================
fun loadData() {
    var ds = contract.getData().beginParse();
    ownerAddress = ds.loadAddress();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .endCell()
    );
}

// =====================================================
// SEND: CHANGE WHITELIST
// =====================================================
fun sendChangeWhitelist(
    giverAddress: address,
    newAddress1: address,
    newAddress2: address,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_CHANGE_WHITELIST, 32)
        .storeUint(queryId, 64)
        .storeAddress(newAddress1)
        .storeAddress(newAddress2)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(giverAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// =====================================================
// SEND: SET WALLET
// =====================================================
fun sendSetWallet(
    giverAddress: address,
    walletAddress: address,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_SET_WALLET, 32)
        .storeUint(queryId, 64)
        .storeAddress(walletAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(giverAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
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

    // =====================================================
    // OP_SET_WALLET — выставить walletAddress в гивере
    // Только owner
    // payload: giverAddress, walletAddress
    // =====================================================
    if (op == OP_SET_WALLET) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var giverAddress = msgBody.loadAddress();
        var walletAddress = msgBody.loadAddress();

        sendSetWallet(
            giverAddress,
            walletAddress,
            queryId
        );

        return;
    }

    // =====================================================
    // OP_CHANGE_WHITELIST — сменить whitelist в гивере
    // Только owner
    // payload: giverAddress, newAddress1, newAddress2
    // =====================================================
    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var giverAddress = msgBody.loadAddress();
        var newAddress1 = msgBody.loadAddress();
        var newAddress2 = msgBody.loadAddress();

        sendChangeWhitelist(
            giverAddress,
            newAddress1,
            newAddress2,
            queryId
        );

        return;
    }

    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================
get fun getManagerData(): address {
    loadData();
    return ownerAddress;
}