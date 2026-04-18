import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========
// GAS POOL v2:
// - хранит курс DOM/TON (domPerTonRate)
// - принимает OP_GAS_POOL_EXECUTE с maxFeeDom от юзера
// - считает реальную комиссию по курсу
// - делит её 2/3 в пул, 1/3 в DAO treasury
// - возвращает лишний DOM юзеру если его maxFee > actual
// ========================================

// TESTNET: 60 сек. MAINNET: 172800 (48ч)
const TIMELOCK_PERIOD: int = 60;

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global adminAddress: address;
global proxyAddress: address;
global domTreasuryAddress: address;

global domBalance: int;   // накопленные DOM комиссии пула
global tonReserve: int;   // минимум TON который пул держит

global domPerTonRate: int;  // min-units DOM за 1 TON (nano)

// Timelock смены treasury
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
    domPerTonRate = ds.loadCoins();

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
        .storeCoins(domPerTonRate)
        .storeBool(hasPendingTreasury);

    if (hasPendingTreasury) {
        b = b.storeAddress(pendingTreasury)
             .storeUint(pendingTreasuryTime, 64);
    }

    contract.setData(b.endCell());
}

// -----------------------------------------------------
// РАСЧЁТ КОМИССИИ
// -----------------------------------------------------
// tonFee (нано) = BASE_TON_COST * TAX_MULTIPLIER / DENOM
// domFee (min-units) = tonFee * domPerTonRate / NANO_TON
// -----------------------------------------------------
fun calculateDomFee(): int {
    var tonFee = BASE_TON_COST
        * TAX_MULTIPLIER
        / TAX_MULTIPLIER_DENOM;

    return tonFee * domPerTonRate / NANO_TON;
}

// -----------------------------------------------------
// ОТПРАВКА DOM ЧЕРЕЗ PROXY
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
// ОТПРАВКА TON НА АДРЕС
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
    var myBalance = contract.getOriginalBalance();

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_GAS_POOL_EXECUTE — от Proxy
    // body: amount | toOwner | fromOwner | maxFeeDom
    // =====================================================
    if (op == OP_GAS_POOL_EXECUTE) {
        assert(
            senderAddress == proxyAddress,
            ERROR_NOT_ADMIN
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var maxFeeDom = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        // Считаем реальную комиссию по курсу
        var actualFee = calculateDomFee();

        // Юзер должен был отправить >= текущей комиссии
        assert(
            maxFeeDom >= actualFee,
            ERROR_LIMIT_EXCEEDED
        );

        // Делим: 2/3 в пул, 1/3 в treasury
        var treasuryShare = actualFee / 3;
        var poolShare = actualFee - treasuryShare;

        domBalance += poolShare;
        saveData();

        // Нужно 3 сообщения с TON на форвард: recipient,
        // treasury, refund юзеру. Каждому MIN_TON_FOR_STORAGE.
        var tonForEach = MIN_TON_FOR_STORAGE;
        var available = myBalance - tonReserve;
        assert(
            available >= tonForEach * 3,
            ERROR_INSUFFICIENT_GAS
        );

        // 1) DOM получателю (полная сумма transfer)
        sendInternalTransfer(
            toOwner, jettonAmount,
            fromOwner, fromOwner,
            queryId, tonForEach
        );

        // 2) DOM в DAO treasury
        sendInternalTransfer(
            domTreasuryAddress, treasuryShare,
            fromOwner, fromOwner,
            queryId + 1, tonForEach
        );

        // 3) Возврат излишка DOM юзеру
        var refund = maxFeeDom - actualFee;
        if (refund > 0) {
            sendInternalTransfer(
                fromOwner, refund,
                fromOwner, fromOwner,
                queryId + 2, tonForEach
            );
        }

        return;
    }

    // =====================================================
    // OP_TOP_UP — пополнение TON (admin)
    // =====================================================
    if (op == OP_TOP_UP) {
        assert(senderAddress == adminAddress, ERROR_NOT_ADMIN);
        return;
    }

    // =====================================================
    // OP_UPDATE_RATE — обновить курс DOM/TON (admin)
    // body: newRate (coins)
    // =====================================================
    if (op == OP_UPDATE_RATE) {
        assert(senderAddress == adminAddress, ERROR_NOT_ADMIN);
        var newRate = msgBody.loadCoins();
        assert(newRate > 0, ERROR_INVALID_AMOUNT);
        domPerTonRate = newRate;
        saveData();
        return;
    }

    // =====================================================
    // OP_WITHDRAW_DOM — вывести накопленные DOM (admin)
    // body: amount | toOwner
    // =====================================================
    if (op == OP_WITHDRAW_DOM) {
        assert(senderAddress == adminAddress, ERROR_NOT_ADMIN);

        var amount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();

        assert(
            amount <= domBalance,
            ERROR_INSUFFICIENT_BALANCE
        );

        domBalance -= amount;
        saveData();

        sendInternalTransfer(
            toOwner, amount,
            contract.getAddress(), adminAddress,
            queryId, MIN_TON_FOR_STORAGE
        );
        return;
    }

    // =====================================================
    // OP_WITHDRAW_TON — вывести излишки TON (admin)
    // body: amount | to
    // =====================================================
    if (op == OP_WITHDRAW_TON) {
        assert(senderAddress == adminAddress, ERROR_NOT_ADMIN);

        var amount = msgBody.loadCoins();
        var to = msgBody.loadAddress();

        var available = myBalance - tonReserve;
        assert(
            amount <= available,
            ERROR_INSUFFICIENT_BALANCE
        );

        sendTon(to, amount, queryId);
        return;
    }

    // =====================================================
    // OP_SET_RESERVE — установить мин TON резерв (admin)
    // =====================================================
    if (op == OP_SET_RESERVE) {
        assert(senderAddress == adminAddress, ERROR_NOT_ADMIN);
        tonReserve = msgBody.loadCoins();
        saveData();
        return;
    }

    // =====================================================
    // OP_CHANGE_TREASURY — таймлок смены treasury
    // subOp: 1=запрос, 2=подтверждение, 3=отмена
    // =====================================================
    if (op == OP_CHANGE_TREASURY) {
        assert(senderAddress == adminAddress, ERROR_NOT_ADMIN);

        var subOp = msgBody.loadUint(8);

        if (subOp == 1) {
            assert(!hasPendingTreasury, ERROR_ALREADY_INITIALIZED);
            pendingTreasury = msgBody.loadAddress();
            pendingTreasuryTime = blockchain.now() + TIMELOCK_PERIOD;
            hasPendingTreasury = true;
            saveData();
            return;
        }

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
    address, address, address,
    int, int, int, int
) {
    loadData();

    var available = contract.getOriginalBalance() - tonReserve;

    return (
        adminAddress,
        proxyAddress,
        domTreasuryAddress,
        domBalance,
        tonReserve,
        domPerTonRate,
        available
    );
}

get fun getCurrentDomFee(): int {
    loadData();
    return calculateDomFee();
}

get fun getPendingTreasury(): (bool, address?, int) {
    loadData();

    if (!hasPendingTreasury) {
        return (false, null, 0);
    }

    return (true, pendingTreasury, pendingTreasuryTime);
}