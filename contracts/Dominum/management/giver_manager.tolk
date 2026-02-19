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

// =====================================================
// STORAGE
// =====================================================
global ownerAddress: slice;

// =====================================================
// LOAD / SAVE
// =====================================================
fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .endCell()
    );
}

// =====================================================
// SEND: CHANGE WHITELIST
// =====================================================
fun sendChangeWhitelist(
    giverAddress: slice,
    newAddress1: slice,
    newAddress2: slice,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_CHANGE_WHITELIST, 32)
        .storeUint(queryId, 64)
        .storeSlice(newAddress1)
        .storeSlice(newAddress2)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(giverAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 64);
}

// =====================================================
// SEND: SET WALLET
// =====================================================
fun sendSetWallet(
    giverAddress: slice,
    walletAddress: slice,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_SET_WALLET, 32)
        .storeUint(queryId, 64)
        .storeSlice(walletAddress)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(giverAddress)
        .storeCoins(MIN_TON_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 64);
}

// =====================================================
// MAIN
// =====================================================
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
    // OP_SET_WALLET — выставить walletAddress в гивере
    // Только owner
    // payload: giverAddress, walletAddress
    // =====================================================
    if (op == OP_SET_WALLET) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var giverAddress = msgBody.loadMsgAddress();
        var walletAddress = msgBody.loadMsgAddress();

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
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var giverAddress = msgBody.loadMsgAddress();
        var newAddress1 = msgBody.loadMsgAddress();
        var newAddress2 = msgBody.loadMsgAddress();

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
get fun getManagerData(): slice {
    loadData();
    return ownerAddress;
}