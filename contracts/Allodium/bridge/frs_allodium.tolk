// =====================================================
// FRS ALLODIUM — Резервная система токена ALLOD
// =====================================================
// Принимает: DOM от Giver Allodium
// Фиксирует: lockedDom
// Отправляет: разрешение минта ALLOD на Master
// Разблокировка: при burn ALLOD от Master
// Курс: 1 DOM = 100 ALLOD (с учетом decimals 6 -> 4)
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================
global ownerAddress: slice;               // СИД-фраза
global domWalletAddress: slice;           // Jetton Wallet FRS для DOM
global allodMasterAddress: slice;         // Master ALLOD
global giverAllodiumAddress: slice;       // откуда принимаем DOM
global allodiumFoundationAddress: slice;  // куда отправляем при разблокировке
global lockedDom: int;                    // заблокировано DOM (в min units)

// =====================================================
// LOAD / SAVE DATA
// =====================================================
fun loadData() {
    var ds = getContractData().beginParse();

    ownerAddress = ds.loadMsgAddress();
    domWalletAddress = ds.loadMsgAddress();
    allodMasterAddress = ds.loadMsgAddress();
    giverAllodiumAddress = ds.loadMsgAddress();
    allodiumFoundationAddress = ds.loadMsgAddress();
    lockedDom = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(domWalletAddress)
            .storeSlice(allodMasterAddress)
            .storeSlice(giverAllodiumAddress)
            .storeSlice(allodiumFoundationAddress)
            .storeCoins(lockedDom)
            .endCell()
    );
}

// =====================================================
// ОТПРАВКА РАЗРЕШЕНИЯ НА MASTER ALLOD
// =====================================================
fun sendMintAllowance(allowanceAmount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_INCREASE_MINT_ALLOWANCE, 32)
        .storeUint(queryId, 64)
        .storeCoins(allowanceAmount)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(allodMasterAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    // carry remaining value от входящего сообщения
    sendRawMessage(msg, 64);
}

// =====================================================
// РАЗБЛОКИРОВКА DOM -> ALLODIUM FOUNDATION
// =====================================================
fun unlockDom(amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(allodiumFoundationAddress)
        .storeSlice(ownerAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(domWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
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
    // OP_TRANSFER_NOTIFICATION — получили DOM от Giver
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        var domAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadMsgAddress();

        assert(
            senderAddress.equalSlices(domWalletAddress),
            ERROR_NOT_VALID_WALLET
        );

        assert(
            fromAddress.equalSlices(giverAllodiumAddress),
            ERROR_NOT_IN_WHITELIST
        );

        assert(domAmount > 0, ERROR_INVALID_AMOUNT);

        // Блокируем DOM
        lockedDom = lockedDom + domAmount;
        saveData();

        // Конвертация min-units:
        // allowance = domAmount * rate / factor
        var scaledAllowance = domAmount
            * EXCHANGE_RATE_DOM_TO_ALLOD;

        assert(
            scaledAllowance % EXCHANGE_DECIMALS_FACTOR == 0,
            ERROR_INVALID_AMOUNT
        );

        var allowanceAmount = scaledAllowance
            / EXCHANGE_DECIMALS_FACTOR;

        assert(allowanceAmount > 0, ERROR_INVALID_AMOUNT);

        sendMintAllowance(allowanceAmount, queryId);
        return;
    }

    // =====================================================
    // OP_ALLOD_BURNED — ALLOD сожжен на Master
    // =====================================================
    if (op == OP_ALLOD_BURNED) {
        assert(
            senderAddress.equalSlices(allodMasterAddress),
            ERROR_NOT_MASTER
        );

        var burnedAllod = msgBody.loadCoins();
        assert(burnedAllod > 0, ERROR_INVALID_AMOUNT);

        // domToUnlock = burnedAllod * factor / rate
        var scaledDom = burnedAllod
            * EXCHANGE_DECIMALS_FACTOR;

        assert(
            scaledDom % EXCHANGE_RATE_DOM_TO_ALLOD == 0,
            ERROR_INVALID_AMOUNT
        );

        var domToUnlock = scaledDom
            / EXCHANGE_RATE_DOM_TO_ALLOD;

        assert(domToUnlock > 0, ERROR_INVALID_AMOUNT);

        assert(
            lockedDom >= domToUnlock,
            ERROR_INSUFFICIENT_BALANCE
        );

        lockedDom = lockedDom - domToUnlock;
        saveData();

        unlockDom(domToUnlock, queryId);
        return;
    }

    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================
get fun getFrsData(): (slice, slice, slice, slice, slice, int) {
    loadData();

    return (
        ownerAddress,
        domWalletAddress,
        allodMasterAddress,
        giverAllodiumAddress,
        allodiumFoundationAddress,
        lockedDom
    );
}

get fun getLockedDom(): int {
    loadData();
    return lockedDom;
}

get fun getMaxAllod(): int {
    loadData();

    var scaledAllowance = lockedDom
        * EXCHANGE_RATE_DOM_TO_ALLOD;

    return scaledAllowance
        / EXCHANGE_DECIMALS_FACTOR;
}