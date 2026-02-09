import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// GAS PROXY — Прокси для Gas Pool
// =====================================================
// Вечный контракт. Wallet ссылается на него навсегда.
// Пересылает OP_GAS_POOL_EXECUTE на реальный Gas Pool.
// Админ может менять realGasPoolAddress через timelock.
//
// Timelock: 48 часов между запросом и подтверждением.
// За это время можно заметить взлом и отменить.
//
// Контракт максимально простой = минимум багов.
// =====================================================

// 48 часов в секундах
const TIMELOCK_PERIOD: int = 172800;

global adminAddress: slice;
global realGasPoolAddress: slice;

// Timelock
global pendingAddress: slice;
global pendingTime: int;
global hasPending: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();

    adminAddress = ds.loadMsgAddress();
    realGasPoolAddress = ds.loadMsgAddress();
    hasPending = ds.loadBool();

    if (hasPending) {
        pendingAddress = ds.loadMsgAddress();
        pendingTime = ds.loadUint(64);
    }
}

fun saveData() {
    var b = beginCell()
        .storeSlice(adminAddress)
        .storeSlice(realGasPoolAddress)
        .storeBool(hasPending);

    if (hasPending) {
        b = b.storeSlice(pendingAddress)
             .storeUint(pendingTime, 64);
    }

    setContractData(b.endCell());
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------

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

    // =====================================================
    // OP_GAS_POOL_EXECUTE — от Wallet
    // Пересылаем на реальный Gas Pool
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        var fullBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeSlice(msgBody)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(realGasPoolAddress)
            .storeCoins(0)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(fullBody)
            .endCell();

        sendRawMessage(msg, 64);

        return;
    }

    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_REQUEST_CHANGE_POOL — запрос смены (48ч timelock)
    // Только admin
    // =====================================================
    if (op == OP_REQUEST_CHANGE_POOL) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        pendingAddress = msgBody.loadMsgAddress();
        pendingTime = now() + TIMELOCK_PERIOD;
        hasPending = true;
        saveData();

        return;
    }

    // =====================================================
    // OP_CONFIRM_CHANGE_POOL — подтверждение (после 48ч)
    // Только admin
    // =====================================================
    if (op == OP_CONFIRM_CHANGE_POOL) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        assert(hasPending, ERROR_NO_PENDING);
        assert(now() >= pendingTime, ERROR_TOO_EARLY);

        realGasPoolAddress = pendingAddress;
        hasPending = false;
        saveData();

        return;
    }

    // =====================================================
    // OP_CANCEL_CHANGE_POOL — отмена запроса
    // Только admin. Можно в любой момент.
    // =====================================================
    if (op == OP_CANCEL_CHANGE_POOL) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        hasPending = false;
        saveData();

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getProxyData(): (slice, slice, int) {
    loadData();

    return (
        adminAddress,
        realGasPoolAddress,
        hasPending
    );
}

get fun getPendingChange(): (int, slice, int) {
    loadData();

    if (!hasPending) {
        return (
            false,
            beginCell()
                .storeUint(0, 2)
                .endCell()
                .beginParse(),
            0
        );
    }

    return (
        true,
        pendingAddress,
        pendingTime
    );
}