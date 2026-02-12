import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// GAS POOL — пул газа
// =====================================================
// Принимает: OP_GAS_POOL_EXECUTE от Proxy
// Делает: 2 команды в Proxy на internal transfers
// Накапливает: domBalance (комиссия gasPoolFee)
// =====================================================

// 48 часов в секундах
const TIMELOCK_PERIOD: int = 172800;

global adminAddress: slice;
global proxyAddress: slice;
global domTreasuryAddress: slice;

global domBalance: int;
global tonReserve: int;

// Timelock для смены treasury
global pendingTreasury: slice;
global pendingTreasuryTime: int;
global hasPendingTreasury: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = getContractData().beginParse();

    adminAddress = ds.loadMsgAddress();
    proxyAddress = ds.loadMsgAddress();
    domTreasuryAddress = ds.loadMsgAddress();

    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();

    hasPendingTreasury = ds.loadBool();

    if (hasPendingTreasury) {
        pendingTreasury = ds.loadMsgAddress();
        pendingTreasuryTime = ds.loadUint(64);
    }
}

fun saveData() {
    var b = beginCell()
        .storeSlice(adminAddress)
        .storeSlice(proxyAddress)
        .storeSlice(domTreasuryAddress)
        .storeCoins(domBalance)
        .storeCoins(tonReserve)
        .storeBool(hasPendingTreasury);

    if (hasPendingTreasury) {
        b = b.storeSlice(pendingTreasury)
             .storeUint(pendingTreasuryTime, 64);
    }

    setContractData(b.endCell());
}

// -----------------------------------------------------
// SEND INTERNAL TRANSFER VIA PROXY
// -----------------------------------------------------
fun sendInternalTransfer(
    toOwner: slice,
    jettonAmount: int,
    fromOwner: slice,
    responseDestination: slice,
    queryId: int,
    msgValue: int
) {
    if (jettonAmount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_PROXY_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(toOwner)
        .storeSlice(fromOwner)
        .storeSlice(responseDestination)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(proxyAddress)
        .storeCoins(msgValue)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// SEND TON
// -----------------------------------------------------
fun sendTon(to: slice, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(to)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
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
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_GAS_POOL_EXECUTE — от Proxy
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        assert(
            senderAddress.equalSlices(proxyAddress),
            ERROR_NOT_ADMIN
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var fromOwner = msgBody.loadMsgAddress();
        var treasuryFee = msgBody.loadCoins();
        var gasPoolFee = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        assert(treasuryFee >= TAX_AMOUNT, ERROR_INVALID_AMOUNT);
        assert(gasPoolFee >= TAX_HALF, ERROR_INVALID_AMOUNT);

        var tonForTransfers = MIN_TON_FOR_STORAGE * 2;
        var availableTon = myBalance - tonReserve;

        assert(
            availableTon >= tonForTransfers,
            ERROR_INSUFFICIENT_GAS
        );

        domBalance += gasPoolFee;
        saveData();

        // 1) Получателю
        sendInternalTransfer(
            toOwner,
            jettonAmount,
            fromOwner,
            fromOwner,
            queryId,
            MIN_TON_FOR_STORAGE
        );

        // 2) DOM Treasury
        sendInternalTransfer(
            domTreasuryAddress,
            treasuryFee,
            fromOwner,
            fromOwner,
            queryId + 1,
            MIN_TON_FOR_STORAGE
        );

        return;
    }

    // =====================================================
    // OP_TOP_UP — пополнение TON (только admin)
    // =====================================================
    if (op == OP_TOP_UP) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        return;
    }

    // =====================================================
    // OP_WITHDRAW_DOM — вывести DOM (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_DOM) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        var amount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();

        assert(
            amount <= domBalance,
            ERROR_INSUFFICIENT_BALANCE
        );

        domBalance -= amount;
        saveData();

        sendInternalTransfer(
            toOwner,
            amount,
            myAddress(),
            adminAddress,
            queryId,
            MIN_TON_FOR_STORAGE
        );

        return;
    }

    // =====================================================
    // OP_WITHDRAW_TON — вывести TON (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_TON) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        var amount = msgBody.loadCoins();
        var to = msgBody.loadMsgAddress();

        var availableTon = myBalance
            - tonReserve
            - msgValue;

        assert(
            amount <= availableTon,
            ERROR_INSUFFICIENT_BALANCE
        );

        sendTon(to, amount, queryId);
        return;
    }

    // =====================================================
    // OP_SET_RESERVE — установить резерв (только admin)
    // =====================================================
    if (op == OP_SET_RESERVE) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        tonReserve = msgBody.loadCoins();
        saveData();

        return;
    }

    // =====================================================
    // OP_CHANGE_TREASURY — смена Treasury (timelock 48ч)
    // subOp: 1=запрос, 2=подтверждение, 3=отмена
    // =====================================================
    if (op == OP_CHANGE_TREASURY) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_ADMIN
        );

        var subOp = msgBody.loadUint(8);

        // Запрос смены
        if (subOp == 1) {
            pendingTreasury = msgBody.loadMsgAddress();
            pendingTreasuryTime = now() + TIMELOCK_PERIOD;
            hasPendingTreasury = true;
            saveData();
            return;
        }

        // Подтверждение (после 48ч)
        if (subOp == 2) {
            assert(hasPendingTreasury, ERROR_NO_PENDING);
            assert(
                now() >= pendingTreasuryTime,
                ERROR_TOO_EARLY
            );

            domTreasuryAddress = pendingTreasury;
            hasPendingTreasury = false;
            saveData();
            return;
        }

        // Отмена
        if (subOp == 3) {
            hasPendingTreasury = false;
            saveData();
            return;
        }

        throw(0xffff);
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getPoolData(): (
    slice, slice, slice, int, int, int
) {
    loadData();

    var availableTon = getContractBalance()
        - tonReserve;

    return (
        adminAddress,
        proxyAddress,
        domTreasuryAddress,
        domBalance,
        tonReserve,
        availableTon
    );
}

get fun getPendingTreasury(): (int, slice, int) {
    loadData();

    if (!hasPendingTreasury) {
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
        pendingTreasury,
        pendingTreasuryTime
    );
}