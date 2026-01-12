import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// BANK DOMINUM — главный банк экосистемы DOM
// =====================================================
// Управляется: ownerAddress (сид/QR)
// Функции:
// - управляет Treasury Manager
// - через Treasury Manager управляет Gas Pool (курс/вывод/пополнение)
// - может выводить TON и (опционально) DOM со своего jetton wallet
// =====================================================

// =====================================================
// STORAGE
// =====================================================

global ownerAddress: slice;           // СИД-фраза владельца
global treasuryManagerAddress: slice; // Адрес Treasury Manager

// Jetton Wallet DOM банка (если банк принимает DOM напрямую)
global domWalletAddress: slice;

// =====================================================
// LOAD / SAVE
// =====================================================

fun loadData() {
    var ds = getContractData().beginParse();

    ownerAddress = ds.loadMsgAddress();
    treasuryManagerAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(treasuryManagerAddress)
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

fun sendToTreasuryManager(
    op: int,
    body: cell,
    value: int,
    queryId: int
) {
    var msgBody = beginCell()
        .storeUint(op, 32)
        .storeUint(queryId, 64)
        .storeRef(body)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(treasuryManagerAddress)
        .storeCoins(value)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
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

    // Смена owner банка
    if (op == OP_CHANGE_ADMIN) {
        requireOwner(senderAddress);

        var newOwner = msgBody.loadMsgAddress();
        ownerAddress = newOwner;
        saveData();

        return;
    }

    // Смена Treasury Manager (банк переезжает)
    if (op == OP_CHANGE_TREASURY_MANAGER) {
        requireOwner(senderAddress);

        var newManager = msgBody.loadMsgAddress();
        treasuryManagerAddress = newManager;
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
    // Управление Gas Pool через Treasury Manager
    // =====================================================

    // Обновить адрес Gas Pool
    if (op == OP_UPDATE_GAS_POOL) {
        requireOwner(senderAddress);

        var newGasPool = msgBody.loadMsgAddress();

        sendToTreasuryManager(
            OP_UPDATE_GAS_POOL,
            beginCell().storeSlice(newGasPool).endCell(),
            MIN_TON_FOR_TRANSFER,
            queryId
        );

        return;
    }

    // Обновить курс в Gas Pool
    if (op == OP_UPDATE_POOL_RATE) {
        requireOwner(senderAddress);

        var newRate = msgBody.loadUint(32);

        sendToTreasuryManager(
            OP_UPDATE_POOL_RATE,
            beginCell().storeUint(newRate, 32).endCell(),
            MIN_TON_FOR_TRANSFER,
            queryId
        );

        return;
    }

    // Вывести DOM из Gas Pool
    if (op == OP_WITHDRAW_FROM_POOL) {
        requireOwner(senderAddress);

        var toAddress = msgBody.loadMsgAddress();
        var amount = msgBody.loadCoins();

        var payload = beginCell()
            .storeSlice(toAddress)
            .storeCoins(amount)
            .endCell();

        sendToTreasuryManager(
            OP_WITHDRAW_FROM_POOL,
            payload,
            MIN_TON_FOR_TRANSFER,
            queryId
        );

        return;
    }

    // Пополнить TON в Gas Pool (tonAmount берётся из msgValue банка)
    // Здесь банк отправляет команду в Treasury Manager и прикладывает TON.
    if (op == OP_REFILL_POOL) {
        requireOwner(senderAddress);

        var tonAmount = msgBody.loadCoins();

        // Команду шлём в Treasury Manager, а msgValue = tonAmount
        var cmd = beginCell()
            .storeUint(OP_REFILL_POOL, 32)
            .storeUint(queryId, 64)
            .storeCoins(tonAmount)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(treasuryManagerAddress)
            .storeCoins(tonAmount)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(cmd)
            .endCell();

        sendRawMessage(msg, 1);

        return;
    }

    // =====================================================
    // Уведомления о получении DOM (можно просто игнорировать)
    // =====================================================
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
        treasuryManagerAddress,
        domWalletAddress,
        getBalance().0
    );
}