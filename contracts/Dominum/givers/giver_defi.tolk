// =====================================================
// GIVER DEFI — Автораспределение DOM для DeFi-блока
// =====================================================
// При получении жетонов — АВТОМАТИЧЕСКИ:
// • 50% → Foundry (Dual-Sign контракт)
// • 50% → Market Maker (биржевые операции)
// Manager может: ТОЛЬКО менять whitelist (2 адреса)
// Налог DOM + комиссия Gas Pool снимаются всегда.
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

const FEE_MAGIC: int = 0xDA0FEE01;

global managerAddress: slice;
global walletAddress: slice;

global defiBankAddress: slice;
global defiDualAddress: slice;

fun loadData() {
    var ds = getContractData().beginParse();

    managerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();

    defiBankAddress = ds.loadMsgAddress();
    defiDualAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(managerAddress)
            .storeSlice(walletAddress)
            .storeSlice(defiBankAddress)
            .storeSlice(defiDualAddress)
            .endCell()
    );
}

fun buildFeePayload(): cell {
    return beginCell()
        .storeUint(FEE_MAGIC, 32)
        .storeCoins(TAX_AMOUNT)  // единый налог в DOM Treasury
        .storeCoins(TAX_HALF)    // комиссия Gas Pool
        .endCell();
}

fun sendJettons(
    toAddress: slice,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var payload = buildFeePayload();

    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(toAddress)
        .storeBool(true)
        .storeRef(payload)
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

    sendJettons(defiBankAddress, half - feeTotal, queryId);
    sendJettons(defiDualAddress, remainder - feeTotal, queryId + 1);
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            senderAddress.equalSlices(walletAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        autoDistribute(amount, queryId);

        return;
    }

    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress.equalSlices(managerAddress),
            ERROR_NOT_MANAGER
        );

        var newAddress1 = msgBody.loadMsgAddress();
        var newAddress2 = msgBody.loadMsgAddress();

        defiBankAddress = newAddress1;
        defiDualAddress = newAddress2;

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
        defiBankAddress,
        defiDualAddress
    );
}