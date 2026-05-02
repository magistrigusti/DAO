// =====================================================
// GIVER ALLODIUM — Автораспределение DOM для Allodium
// =====================================================
// При получении жетонов от master (через свой wallet):
//   50% -> FRS Allodium
//   50% -> Allodium Foundation
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
global frsAllodiumAddress: address;
global allodiumFoundationAddress: address;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------
fun loadData() {
    var ds = contract.getData().beginParse();

    managerAddress = ds.loadAddress();
    walletAddress = ds.loadAddressOpt();

    var targets = ds.loadRef().beginParse();
    frsAllodiumAddress = targets.loadAddress();
    allodiumFoundationAddress = targets.loadAddress();
}

fun saveData() {
    var targets = beginCell()
        .storeAddress(frsAllodiumAddress)
        .storeAddress(allodiumFoundationAddress)
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
// Тело OP_TRANSFER:
//   amount | toOwner | responseDest | maxFeeDom
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
// amount — то что пришло с master через наш wallet.
// Резервируем 2 * GIVER_MAX_FEE_DOM на комиссии
// (излишек вернётся рефандом), остаток делим пополам.
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

    sendJettons(frsAllodiumAddress, half, queryId);
    sendJettons(allodiumFoundationAddress, remainder, queryId + 1);
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

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_TRANSFER_NOTIFICATION — получили DOM через свой wallet
    // body: amount | fromOwner
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

        // Рефанд от gas_pool (через наш же wallet).
        // fromAddress = наш адрес → не распределяем,
        // просто оставляем на балансе wallet.
        if (fromAddress == contract.getAddress()) {
            return;
        }

        autoDistribute(amount, queryId);
        return;
    }

    // =====================================================
    // OP_SET_WALLET — выставить walletAddress (manager only)
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
    // OP_CHANGE_WHITELIST — сменить получателей (manager only)
    // =====================================================
    if (op == OP_CHANGE_WHITELIST) {
        assert(
            senderAddress == managerAddress,
            ERROR_NOT_MANAGER
        );

        frsAllodiumAddress = msgBody.loadAddress();
        allodiumFoundationAddress = msgBody.loadAddress();

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
        frsAllodiumAddress,
        allodiumFoundationAddress
    );
}
