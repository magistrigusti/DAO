import "treasury_storage.tolk";
import "treasury_roles.tolk";
import "../core/op_codes.tolk";
import "../core/constants.tolk";
import "../core/errors.tolk";

fun treasuryInitMasterConfig(
    newMasterAddress: address,
    newWalletCode: cell,
    queryId: int
) {
    assert(!masterConfigured, ERROR_ALREADY_INITIALIZED);
    masterAddress = newMasterAddress;
    jettonWalletCode = newWalletCode;
    masterConfigured = true;
    treasurySaveData();
    var body = beginCell()
        .storeUint(OP_INIT_MASTER_CONFIG, 32)
        .storeUint(queryId, 64)
        .storeAddress(newMasterAddress)
        .storeRef(newWalletCode)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasurySendGrams(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasurySendDom(
    toAddress: address,
    amount: int,
    queryId: int
) {
    treasuryRequireWalletConfigured();
    if (amount <= 0) {
        return;
    }
    var body = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(jettonWalletAddress)
        .storeCoins(MIN_GRAMS_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasuryRefillGasPool(amount: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_TOP_UP, 32)
        .storeUint(queryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasuryRequestDomFromGasPool(amount: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_WITHDRAW_DOM, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasurySendGasExecution(routeId: int, fee: int) {
    var body = beginCell()
        .storeUint(OP_GAS_POOL_EXECUTE, 32)
        .storeUint(routeId, 64)
        .storeCoins(fee)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 64);
}

fun treasurySendGasCommit(routeId: int) {
    var body = beginCell()
        .storeUint(OP_GAS_POOL_COMMIT, 32)
        .storeUint(routeId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(gasPoolAddress)
        .storeCoins(PROTOCOL_CONTROL_GRAMS)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasurySendWalletDelivery(
    routeId: int,
    leg: int,
    toOwner: address,
    amount: int,
    fromOwner: address
) {
    var stateInit = treasuryWalletStateInit(toOwner);
    var walletAddress = treasuryWalletAddress(toOwner);
    var body = beginCell()
        .storeUint(OP_PROTOCOL_DELIVERY, 32)
        .storeUint(routeId, 64)
        .storeUint(leg, 8)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(PROTOCOL_DELIVERY_GRAMS)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}

fun treasurySendSourceResult(
    routeId: int,
    sourceWallet: address,
    sourceQueryId: int,
    success: bool
) {
    var resultOp = OP_TREASURY_FAILED;
    if (success) {
        resultOp = OP_TREASURY_SETTLE;
    }
    var body = beginCell()
        .storeUint(resultOp, 32)
        .storeUint(routeId, 64)
        .storeUint(sourceQueryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(sourceWallet)
        .storeCoins(PROTOCOL_CONTROL_GRAMS)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 64);
}

fun treasurySendFinalization(
    toAddress: address,
    routeId: int,
    sourceQueryId: int
) {
    var body = beginCell()
        .storeUint(OP_PROTOCOL_FINALIZE, 32)
        .storeUint(routeId, 64)
        .storeUint(sourceQueryId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(toAddress)
        .storeCoins(PROTOCOL_CONTROL_GRAMS)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 3);
}

fun treasuryHandleFinance(
    op: int,
    senderAddress: address,
    msgValue: int,
    myBalance: int,
    queryId: int,
    msgBody: slice
): bool {
    if (op == OP_WITHDRAW) {
        treasuryRequireOwner(senderAddress);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            treasuryIsAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );
        assert(
            amount + MIN_GRAMS_FOR_STORAGE <= myBalance,
            ERROR_INSUFFICIENT_BALANCE
        );
        totalSentNanograms += amount;
        treasurySaveData();
        treasurySendGrams(toAddress, amount, queryId);
        return true;
    }
    if (op == OP_WITHDRAW_JETTONS) {
        treasuryRequireOwner(senderAddress);
        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadAddress();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            treasuryIsAllowedTarget(toAddress),
            ERROR_NOT_IN_WHITELIST
        );
        assert(
            msgValue >= MIN_GRAMS_FOR_TRANSFER,
            ERROR_INSUFFICIENT_GAS
        );
        totalSentDom += amount;
        treasurySaveData();
        treasurySendDom(toAddress, amount, queryId);
        return true;
    }
    if (op == OP_REFILL_POOL) {
        treasuryRequireOwner(senderAddress);
        var amount = msgBody.loadCoins();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            amount + MIN_GRAMS_FOR_STORAGE <= myBalance,
            ERROR_INSUFFICIENT_BALANCE
        );
        totalSentNanograms += amount;
        treasurySaveData();
        treasuryRefillGasPool(amount, queryId);
        return true;
    }
    if (op == OP_WITHDRAW_FROM_POOL) {
        treasuryRequireOwner(senderAddress);
        var amount = msgBody.loadCoins();
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        assert(
            msgValue >= MIN_GRAMS_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );
        treasuryRequestDomFromGasPool(amount, queryId);
        return true;
    }
    return false;
}
