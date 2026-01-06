// =====================================================
// GIVER INVEST — Автораспределение DOM для инвест-блока
// =====================================================
// При получении жетонов — АВТОМАТИЧЕСКИ:
// • 50% → Invest Address #1
// • 50% → Invest Address #2
// Manager может: ТОЛЬКО менять whitelist
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// STORAGE
global managerAddress: slice;
global walletAddress: slice;

global investAddress1: slice;  // Whitelist #1 (50%)
global investAddress2: slice;  // Whitelist #2 (50%)

fun loadData() {
    var ds = getContractData().beginParse();

    managerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
    investAddress1 = ds.loadMsgAddress();
    investAddress2 = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(managerAddress)
            .storeSlice(walletAddress)
            .storeSlice(investAddress1)
            .storeSlice(investAddress2)
            .endCell()
    );
}

fun sendJettons(toAddress: slice, amount: int, queryId: int) {
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
    var half = amount / 2;
    var remainder = amount - half;

    sendJettons(investAddress1, half, queryId);
    sendJettons(investAddress2, remainder, queryId + 1);
}

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

    // Получили жетоны — автораспределение
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress.equalSlices(walletAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        autoDistribute(amount, queryId);

        return;
    }

    // Смена whitelist — только Manager
    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress.equalSlices(managerAddress),
            ERROR_NOT_MANAGER
        );

        var newAddress1 = msgBody.loadMsgAddress();
        var newAddress2 = msgBody.loadMsgAddress();

        investAddress1 = newAddress1;
        investAddress2 = newAddress2;

        saveData();

        return;
    }

    throw(0xffff);
}

get fun getGiverData(): (slice, slice, slice, slice) {
    loadData();

    return (
        managerAddress,
        walletAddress,
        investAddress1,
        investAddress2
    );
}