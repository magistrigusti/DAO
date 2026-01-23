import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// BANK INVEST — банк инвест-блока Dominum
// =====================================================
// Принимает: DOM и TON
// Управляется: СИД-фраза (owner)
// =====================================================

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;
global walletAddress: slice;

// =====================================================
// LOAD / SAVE
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();
    ownerAddress = ds.loadMsgAddress();
    walletAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(walletAddress)
            .endCell()
    );
}

// =====================================================
// ВЫВОД TON
// =====================================================

fun withdrawTon(toAddress: slice, amount: int) {
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();

    sendRawMessage(msg, 1);
}

// =====================================================
// ВЫВОД ЖЕТОНОВ DOM
// =====================================================

fun withdrawJettons(toAddress: slice, amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress)
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

// =====================================================
// ОБРАБОТКА ВХОДЯЩИХ СООБЩЕНИЙ
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

    // Получили жетоны DOM
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }

    // Вывод TON
    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);

        withdrawTon(toAddress, amount);
        return;
    }

    // Вывод жетонов
    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(amount > 0, ERROR_INVALID_AMOUNT);

        withdrawJettons(toAddress, amount, queryId);
        return;
    }

    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getInvestBankData(): (slice, slice, int) {
    loadData();

    return (
        ownerAddress,
        walletAddress,
        getBalance().0
    );
}