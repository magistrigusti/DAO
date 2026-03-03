import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

// =====================================================
// GAS POOL — пул газа
// =====================================================
// Принимает: OP_GAS_POOL_EXECUTE от Proxy
// Делает: 2 команды в Proxy на internal transfers
// Накапливает: domBalance (комиссия gasPoolFee)
// =====================================================

// TESTNET: 60 сек. MAINNET: 172800 (48ч)
const TIMELOCK_PERIOD: int = 60;

global adminAddress: address;
global proxyAddress: address;
global domTreasuryAddress: address;

global domBalance: int;
global tonReserve: int;

// Timelock для смены treasury
global pendingTreasury: address;
global pendingTreasuryTime: int;
global hasPendingTreasury: bool;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    adminAddress = ds.loadAddress();
    proxyAddress = ds.loadAddress();
    domTreasuryAddress = ds.loadAddress();

    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();

    hasPendingTreasury = ds.loadBool();

    if (hasPendingTreasury) {
        pendingTreasury = ds.loadAddress();
        pendingTreasuryTime = ds.loadUint(64);
    } else {
        pendingTreasury = domTreasuryAddress;
        pendingTreasuryTime = 0;
    }
}

fun saveData() {
    var b = beginCell()
        .storeAddress(adminAddress)
        .storeAddress(proxyAddress)
        .storeAddress(domTreasuryAddress)
        .storeCoins(domBalance)
        .storeCoins(tonReserve)
        .storeBool(hasPendingTreasury);

    if (hasPendingTreasury) {
        b = b.storeAddress(pendingTreasury)
             .storeUint(pendingTreasuryTime, 64);
    }

    contract.setData(b.endCell());
}

// -----------------------------------------------------
// SEND INTERNAL TRANSFER VIA PROXY
// -----------------------------------------------------
fun sendInternalTransfer(
    toOwner: address,
    jettonAmount: int,
    fromOwner: address,
    responseDestination: address,
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
        .storeAddress(toOwner)
        .storeAddress(fromOwner)
        .storeAddress(responseDestination)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(proxyAddress)
        .storeCoins(msgValue)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// SEND TON
// -----------------------------------------------------
fun sendTon(to: address, amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(to)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;
    var myBalance = contract.getOriginalBalance();

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_GAS_POOL_EXECUTE — от Proxy
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        assert(
            senderAddress == proxyAddress,
            ERROR_NOT_ADMIN
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var treasuryFee = msgBody.loadCoins();
        var gasPoolFee = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        // Фиксированные комиссии без курса.
        assert(treasuryFee == TAX_AMOUNT, ERROR_INVALID_AMOUNT);
        assert(gasPoolFee == TAX_HALF, ERROR_INVALID_AMOUNT);

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
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );

        return;
    }

    // =====================================================
    // OP_WITHDRAW_DOM — вывести DOM (только admin)
    // =====================================================
    if (op == OP_WITHDRAW_DOM) {
        assert(
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );

        var amount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();

        assert(
            amount <= domBalance,
            ERROR_INSUFFICIENT_BALANCE
        );

        domBalance -= amount;
        saveData();

        sendInternalTransfer(
            toOwner,
            amount,
            contract.getAddress(),
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
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );

        var amount = msgBody.loadCoins();
        var to = msgBody.loadAddress();

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
            senderAddress == adminAddress,
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
            senderAddress == adminAddress,
            ERROR_NOT_ADMIN
        );

        var subOp = msgBody.loadUint(8);

        // Запрос смены
        if (subOp == 1) {
            pendingTreasury = msgBody.loadAddress();
            pendingTreasuryTime = blockchain.now() + TIMELOCK_PERIOD;
            hasPendingTreasury = true;
            saveData();
            return;
        }

        // Подтверждение (после 48ч)
        if (subOp == 2) {
            assert(hasPendingTreasury, ERROR_NO_PENDING);
            assert(
                blockchain.now() >= pendingTreasuryTime,
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
    address, address, address, int, int, int
) {
    loadData();

    var availableTon = contract.getOriginalBalance()
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

get fun getPendingTreasury(): (bool, address?, int) {
    loadData();

    if (!hasPendingTreasury) {
        return (
            false,
            null,
            0
        );
    }

    return (
        true,
        pendingTreasury,
        pendingTreasuryTime
    );
}