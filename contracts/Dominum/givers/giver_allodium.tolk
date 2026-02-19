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

// =====================================================
// STORAGE
// =====================================================
global managerAddress: slice;
global walletAddress: slice;
global frsAllodiumAddress: slice;
global allodiumFoundationAddress: slice;

// =====================================================
// LOAD / SAVE
// =====================================================
fun loadData() {
    var ds = getContractData().beginParse();
    managerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
    frsAllodiumAddress = ds.loadMsgAddress();
    allodiumFoundationAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(managerAddress)
            .storeSlice(walletAddress)
            .storeSlice(frsAllodiumAddress)
            .storeSlice(allodiumFoundationAddress)
            .endCell()
    );
}

fun sendJettons(
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
        .storeSlice(toAddress)
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress.equalSlices(walletAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        autoDistribute(amount, queryId);
        return;
    }

    // =====================================================
    // OP_SET_WALLET — только Manager
    // payload: walletAddress
    // =====================================================
    if (op == OP_SET_WALLET) {
        assert(
            senderAddress.equalSlices(managerAddress),
            ERROR_NOT_MANAGER
        );

        var newWalletAddress = msgBody.loadMsgAddress();
        walletAddress = newWalletAddress;
        saveData();
        return;
    }

    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress.equalSlices(managerAddress),
            ERROR_NOT_MANAGER
        );

        var newAddress1 = msgBody.loadMsgAddress();
        var newAddress2 = msgBody.loadMsgAddress();

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
get fun getGiverData(): (slice, slice, slice, slice) {
    loadData();
    return (
        managerAddress,
        walletAddress,
        frsAllodiumAddress,
        allodiumFoundationAddress
    );
}