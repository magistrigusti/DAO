import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// =====================================================
// BANK DOMINUM — главный банк экосистемы DOM
// =====================================================
// Управляется: ownerAddress (сид/QR)
// Функции:
// - управляет Gas Pool напрямую (курс/вывод/пополнение)
// - может выводить TON и (опционально) DOM со своего jetton wallet
// Владельца не меняем.
// =====================================================

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;     // СИД-фраза владельца
global gasPoolAddress: slice;   // Адрес Gas Pool
global domWalletAddress: slice; // Jetton Wallet банка

// =====================================================
// LOAD / SAVE
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();

    ownerAddress = ds.loadMsgAddress();
    gasPoolAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(gasPoolAddress)
            .storeSlice(domWalletAddress)
            .endCell()
    );
}

// =====================================================
// HELPERS
// =====================================================

fun requireOwner(sender: slice) {
    assert(sender.equalSlices(ownerAddress), ERROR_NOT_OWNER);
}

fun sendTon(toAddress: slice, amount: int) {
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .endCell();

    sendRawMessage(msg, 1);
}

// Вывод DOM со своего Jetton Wallet (если нужно банку)
fun withdrawDomJettons(toAddress: slice, amount: int, queryId: int) {
    var transferBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress) // response_destination
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(domWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(transferBody)
        .endCell();

    sendRawMessage(msg, 1);
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
    // Пустое сообщение — просто принимаем TON на баланс банка
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
    // Админка банка (только owner)
    // =====================================================

    // Смена адреса Gas Pool
    if (op == OP_UPDATE_GAS_POOL) {
        requireOwner(senderAddress);

        var newGasPool = msgBody.loadMsgAddress();
        gasPoolAddress = newGasPool;
        saveData();

        return;
    }

    // Вывод TON с банка
    if (op == OP_WITHDRAW) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        sendTon(toAddress, amount);

        return;
    }

    // Вывод DOM (jetton) с банка
    if (op == OP_WITHDRAW_JETTONS) {
        requireOwner(senderAddress);

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        withdrawDomJettons(toAddress, amount, queryId);

        return;
    }

    // =====================================================
    // Управление Gas Pool напрямую
    // =====================================================

    // Обновить курс в Gas Pool
    if (op == OP_UPDATE_POOL_RATE) {
        requireOwner(senderAddress);

        var newRate = msgBody.loadUint(32);

        var body = beginCell()
            .storeUint(OP_UPDATE_RATE, 32)
            .storeUint(queryId, 64)
            .storeUint(newRate, 32)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(MIN_TON_FOR_STORAGE)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 1);

        return;
    }

    // Вывести DOM из Gas Pool
    if (op == OP_WITHDRAW_FROM_POOL) {
        requireOwner(senderAddress);

        var toAddress = msgBody.loadMsgAddress();
        var amount = msgBody.loadCoins();

        var body = beginCell()
            .storeUint(OP_WITHDRAW_DOM, 32)
            .storeUint(queryId, 64)
            .storeSlice(toAddress)
            .storeCoins(amount)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(MIN_TON_FOR_STORAGE)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 1);

        return;
    }

    // Пополнить TON в Gas Pool
    if (op == OP_REFILL_POOL) {
        requireOwner(senderAddress);

        var tonAmount = msgBody.loadCoins();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(tonAmount)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .endCell();

        sendRawMessage(msg, 1);

        return;
    }

    // Уведомления о получении DOM — игнорируем
    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }

    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getBankDominumData(): (slice, slice, slice, int) {
    loadData();

    return (
        ownerAddress,
        gasPoolAddress,
        domWalletAddress,
        getBalance().0
    );
}