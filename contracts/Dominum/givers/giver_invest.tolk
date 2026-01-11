// =====================================================
// GIVER INVEST — Автораспределение DOM для инвест-блока
// =====================================================
// При получении жетонов — АВТОМАТИЧЕСКИ:
// • 50% → Invest Bank (обычный контракт-хранилище)
// • 50% → Invest Dual-Signature (контракт двойной подписи)
// Manager может: ТОЛЬКО менять whitelist (2 адреса)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================

global managerAddress: slice;       // Manager (QR/seed)
global walletAddress: slice;         // Jetton Wallet этого гивера

global investBankAddress: slice;     // Whitelist #1 (50%)
global investDualAddress: slice;     // Whitelist #2 (50%)

// =====================================================
// LOAD / SAVE
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();

    managerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();

    investBankAddress = ds.loadMsgAddress();
    investDualAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(managerAddress)
            .storeSlice(walletAddress)
            .storeSlice(investBankAddress)
            .storeSlice(investDualAddress)
            .endCell()
    );
}

// =====================================================
// SEND JETTONS
// =====================================================

fun sendJettons(
    toAddress: slice,
    amount: int,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(toAddress)   // response_destination
        .storeBool(false)        // custom_payload = none
        .storeCoins(0)           // forward_ton_amount
        .storeBool(false)        // forward_payload (inline пустой)
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

// =====================================================
// AUTO DISTRIBUTE 50/50
// =====================================================

fun autoDistribute(amount: int, queryId: int) {
    var half = amount / 2;
    var remainder = amount - half;

    sendJettons(investBankAddress, half, queryId);
    sendJettons(investDualAddress, remainder, queryId + 1);
}

// =====================================================
// MESSAGES
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

        investBankAddress = newAddress1;
        investDualAddress = newAddress2;

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
        investBankAddress,
        investDualAddress
    );
}