import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== GAS POOL v2 ==========
// Пул TON-газа и DOM-комиссий.
// Пользователь платит комиссию в DOM, пул оплачивает TON.
// Настройки меняет только manager через безопасные операции.
// =================================

// TESTNET: 60 сек. MAINNET: 172800 (48ч)
const TIMELOCK_PERIOD: int = 60;

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global managerAddress: address;
global proxyAddress: address;
global domTreasuryAddress: address;

global domBalance: int;
global tonReserve: int;

global domPerTonRate: int;
global baseTonCost: int;
global taxMultiplier: int;

global hasPendingTreasury: bool;
global pendingTreasury: address;
global pendingTreasuryTime: int;

global hasPendingTax: bool;
global pendingBaseTonCost: int;
global pendingTaxMultiplier: int;
global pendingTaxTime: int;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    managerAddress = ds.loadAddress();
    proxyAddress = ds.loadAddress();
    domTreasuryAddress = ds.loadAddress();

    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();
    domPerTonRate = ds.loadCoins();
    baseTonCost = ds.loadCoins();
    taxMultiplier = ds.loadUint(16);

    hasPendingTreasury = ds.loadBool();
    if (hasPendingTreasury) {
        pendingTreasury = ds.loadAddress();
        pendingTreasuryTime = ds.loadUint(64);
    } else {
        pendingTreasury = domTreasuryAddress;
        pendingTreasuryTime = 0;
    }

    hasPendingTax = ds.loadBool();
    if (hasPendingTax) {
        pendingBaseTonCost = ds.loadCoins();
        pendingTaxMultiplier = ds.loadUint(16);
        pendingTaxTime = ds.loadUint(64);
    } else {
        pendingBaseTonCost = baseTonCost;
        pendingTaxMultiplier = taxMultiplier;
        pendingTaxTime = 0;
    }
}

fun saveData() {
    var b = beginCell()
        .storeAddress(managerAddress)
        .storeAddress(proxyAddress)
        .storeAddress(domTreasuryAddress)
        .storeCoins(domBalance)
        .storeCoins(tonReserve)
        .storeCoins(domPerTonRate)
        .storeCoins(baseTonCost)
        .storeUint(taxMultiplier, 16)
        .storeBool(hasPendingTreasury);

    if (hasPendingTreasury) {
        b = b.storeAddress(pendingTreasury)
             .storeUint(pendingTreasuryTime, 64);
    }

    b = b.storeBool(hasPendingTax);

    if (hasPendingTax) {
        b = b.storeCoins(pendingBaseTonCost)
             .storeUint(pendingTaxMultiplier, 16)
             .storeUint(pendingTaxTime, 64);
    }

    contract.setData(b.endCell());
}

// -----------------------------------------------------
// SERVICE
// -----------------------------------------------------
fun requireManager(senderAddress: address) {
    assert(senderAddress == managerAddress, ERROR_NOT_MANAGER);
}

fun validateTax(newBaseTonCost: int, newTaxMultiplier: int) {
    assert(newBaseTonCost > 0, ERROR_INVALID_AMOUNT);
    assert(newTaxMultiplier >= MIN_TAX_MULTIPLIER, ERROR_INVALID_AMOUNT);
    assert(newTaxMultiplier <= MAX_TAX_MULTIPLIER, ERROR_LIMIT_EXCEEDED);
}

fun calculateDomFee(): int {
    var tonFee = baseTonCost * taxMultiplier / TAX_MULTIPLIER_DENOM;
    return tonFee * domPerTonRate / NANO_TON;
}

// -----------------------------------------------------
// SEND HELPERS
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

    if (op == OP_GAS_POOL_EXECUTE) {
        assert(senderAddress == proxyAddress, ERROR_NOT_MANAGER);

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var maxFeeDom = msgBody.loadCoins();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        var actualFee = calculateDomFee();
        assert(maxFeeDom >= actualFee, ERROR_LIMIT_EXCEEDED);

        var treasuryShare = actualFee / 3;
        var poolShare = actualFee - treasuryShare;
        var tonForEach = MIN_TON_FOR_STORAGE;

        assert(myBalance - tonReserve >= tonForEach * 3, ERROR_INSUFFICIENT_GAS);

        domBalance = domBalance + poolShare;
        saveData();

        sendInternalTransfer(toOwner, jettonAmount, fromOwner, fromOwner, queryId, tonForEach);
        sendInternalTransfer(domTreasuryAddress, treasuryShare, fromOwner, fromOwner, queryId + 1, tonForEach);

        var refund = maxFeeDom - actualFee;
        if (refund > 0) {
            sendInternalTransfer(fromOwner, refund, fromOwner, fromOwner, queryId + 2, tonForEach);
        }
        return;
    }

    if (op == OP_TOP_UP) {
        requireManager(senderAddress);
        return;
    }

    if (op == OP_UPDATE_RATE) {
        requireManager(senderAddress);
        var newRate = msgBody.loadCoins();
        assert(newRate > 0, ERROR_INVALID_AMOUNT);
        domPerTonRate = newRate;
        saveData();
        return;
    }

    if (op == OP_CHANGE_TAX) {
        requireManager(senderAddress);

        var subOp = msgBody.loadUint(8);
        if (subOp == 1) {
            assert(!hasPendingTax, ERROR_ALREADY_INITIALIZED);
            var newBaseTonCost = msgBody.loadCoins();
            var newTaxMultiplier = msgBody.loadUint(16);
            validateTax(newBaseTonCost, newTaxMultiplier);
            pendingBaseTonCost = newBaseTonCost;
            pendingTaxMultiplier = newTaxMultiplier;
            pendingTaxTime = blockchain.now() + TIMELOCK_PERIOD;
            hasPendingTax = true;
            saveData();
            return;
        }
        if (subOp == 2) {
            assert(hasPendingTax, ERROR_NO_PENDING);
            assert(blockchain.now() >= pendingTaxTime, ERROR_TOO_EARLY);
            baseTonCost = pendingBaseTonCost;
            taxMultiplier = pendingTaxMultiplier;
            hasPendingTax = false;
            saveData();
            return;
        }
        if (subOp == 3) {
            hasPendingTax = false;
            saveData();
            return;
        }
        throw(0xffff);
    }

    if (op == OP_WITHDRAW_DOM) {
        requireManager(senderAddress);
        var amount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        assert(amount <= domBalance, ERROR_INSUFFICIENT_BALANCE);
        domBalance = domBalance - amount;
        saveData();
        sendInternalTransfer(toOwner, amount, contract.getAddress(), managerAddress, queryId, MIN_TON_FOR_STORAGE);
        return;
    }

    if (op == OP_WITHDRAW_TON) {
        requireManager(senderAddress);
        var amount = msgBody.loadCoins();
        var to = msgBody.loadAddress();
        assert(amount <= myBalance - tonReserve, ERROR_INSUFFICIENT_BALANCE);
        sendTon(to, amount, queryId);
        return;
    }

    if (op == OP_SET_RESERVE) {
        requireManager(senderAddress);
        tonReserve = msgBody.loadCoins();
        saveData();
        return;
    }

    if (op == OP_CHANGE_TREASURY) {
        requireManager(senderAddress);
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
            assert(blockchain.now() >= pendingTreasuryTime, ERROR_TOO_EARLY);
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
get fun getPoolData(): (address, address, address, int, int, int, int, int, int) {
    loadData();
    return (
        managerAddress, proxyAddress, domTreasuryAddress,
        domBalance, tonReserve, domPerTonRate,
        baseTonCost, taxMultiplier, contract.getOriginalBalance() - tonReserve
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

get fun getPendingTax(): (bool, int, int, int) {
    loadData();
    if (!hasPendingTax) {
        return (false, 0, 0, 0);
    }
    return (true, pendingBaseTonCost, pendingTaxMultiplier, pendingTaxTime);
}
