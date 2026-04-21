// =====================================================
// GIVER DAO — Автораспределение DOM для DAO
// =====================================================
// При получении жетонов от master (через свой wallet):
//   50% -> Bank DAO
//   50% -> DAO Foundation
// Manager может менять whitelist и walletAddress.
//
// v2: защита от рекурсии при рефанде из gas_pool.
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v2 ==========

// -----------------------------------------------------
// STORAGE
// -----------------------------------------------------
global managerAddress: address;
global walletAddress: address?;
global bankDaoAddress: address;
global daoFoundationAddress: address;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    managerAddress = ds.loadAddress();
    walletAddress = ds.loadAddressOpt();

    var targets = ds.loadRef().beginParse();
    bankDaoAddress = targets.loadAddress();
    daoFoundationAddress = targets.loadAddress();
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(bankDaoAddress)
        .storeAddress(daoFoundationAddress)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(managerAddress)
            .storeAddressOpt(walletAddress)
            .storeRef(targets)
            .endCell()
    );
}

// -----------------------------------------------------
// ОТПРАВКА DOM через свой wallet (новый формат v2)
// -----------------------------------------------------
fun sendJettons(
    toAddress: address,
    amount: int,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    assert(walletAddress != null, ERROR_NOT_VALID_WALLET);

    var currentWalletAddress = walletAddress!;

    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(toAddress)
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(currentWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// РАСПРЕДЕЛЕНИЕ 50/50
// -----------------------------------------------------
fun autoDistribute(amount: int, queryId: int) {
    var feeReserve = GIVER_MAX_FEE_DOM * 2;

    assert(
        amount > feeReserve * 2,
        ERROR_INVALID_AMOUNT
    );

    var distributable = amount - feeReserve;
    var half = distributable / 2;
    var remainder = distributable - half;

    sendJettons(bankDaoAddress, half, queryId);
    sendJettons(daoFoundationAddress, remainder, queryId + 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    if (in.isBounced) {
        return;
    }

    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM
    // =====================================================
    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(
            walletAddress != null,
            ERROR_NOT_VALID_WALLET
        );

        assert(
            senderAddress == walletAddress!,
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        // Рефанд от gas_pool — не распределяем повторно
        if (fromAddress == contract.getAddress()) {
            return;
        }

        autoDistribute(amount, queryId);
        return;
    }

    // =====================================================
    // OP_SET_WALLET — manager only
    // =====================================================
    if (op == OP_SET_WALLET) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );

        walletAddress = msgBody.loadAddress();
        saveData();
        return;
    }

    // =====================================================
    // OP_CHANGE_WHITELIST — manager only
    // =====================================================
    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );

        bankDaoAddress = msgBody.loadAddress();
        daoFoundationAddress = msgBody.loadAddress();

        saveData();
        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------
get fun getGiverData(): (
    address, address?, address, address
) {
    loadData();

    return (
        managerAddress,
        walletAddress,
        bankDaoAddress,
        daoFoundationAddress
    );
}
