import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// JETTON WALLET — кошелёк DOM (TEP-74) + комиссия в DOM
// =====================================================
// Комиссия в DOM передаётся через custom_payload (off-chain расчёт).
// Если payload нет — берём минимум TAX_HALF × 3.
// Wallet делает 4 внутренних отправки:
// 1) Получателю amount
// 2) DOM Treasury — domTreasuryFee
// 3) DAO Treasury — daoTreasuryFee
// 4) Gas Pool — gasPoolFee (пул возвращает TON владельцу)
//
// В storage есть jettonWalletCode, чтобы вычислять
// адрес кошелька получателя и служебных адресов.
// =====================================================

const FEE_MAGIC: int = 0xDA0FEE01;

global balance: int;

global ownerAddress: slice;
global masterAddress: slice;

global domTreasuryAddress: slice;
global daoTreasuryAddress: slice;
global gasPoolAddress: slice;

global jettonWalletCode: cell;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();

    balance = ds.loadCoins();

    ownerAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();

    domTreasuryAddress = ds.loadMsgAddress();
    daoTreasuryAddress = ds.loadMsgAddress();
    gasPoolAddress = ds.loadMsgAddress();

    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeCoins(balance)
            .storeSlice(ownerAddress)
            .storeSlice(masterAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(daoTreasuryAddress)
            .storeSlice(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS (для owner получателя)
// -----------------------------------------------------

fun buildWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(masterAddress)
        .storeSlice(domTreasuryAddress)
        .storeSlice(daoTreasuryAddress)
        .storeSlice(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// -----------------------------------------------------
// SEND INTERNAL TRANSFER (to owner's wallet)
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

    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(stateInit);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(fromOwner)
        .storeSlice(responseDestination)
        .storeCoins(0)          // forward_ton_amount
        .storeBool(false)       // forward_payload empty
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toWallet)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// NOTIFY OWNER (transfer_notification)
// -----------------------------------------------------

fun notifyOwner(amount: int, fromOwner: slice, queryId: int) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(fromOwner)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
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
    // OP_INTERNAL_TRANSFER — получили токены
    // =====================================================
    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();

        balance += amount;
        saveData();

        notifyOwner(amount, fromOwner, queryId);

        return;
    }

    // =====================================================
    // OP_TRANSFER — отправка токенов (только owner)
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        // custom_payload: либо нет, либо ref с нашей структурой
        var hasCustom = msgBody.loadBool();

        var domTreasuryFee: int = TAX_HALF;
        var daoTreasuryFee: int = TAX_HALF;
        var gasPoolFee: int = TAX_HALF;

        if (hasCustom) {
            var payload = msgBody.loadRef().beginParse();
            var magic = payload.loadUint(32);

            if (magic == FEE_MAGIC) {
                var newDomFee = payload.loadCoins();
                var newDaoFee = payload.loadCoins();
                var newGasFee = payload.loadCoins();

                if (newDomFee > domTreasuryFee) {
                    domTreasuryFee = newDomFee;
                }
                if (newDaoFee > daoTreasuryFee) {
                    daoTreasuryFee = newDaoFee;
                }
                if (newGasFee > gasPoolFee) {
                    gasPoolFee = newGasFee;
                }
            }
        }

        // forward_ton_amount / forward_payload не используем, но читаем
        _ = msgBody.loadCoins();

        var hasForward = msgBody.loadBool();
        if (hasForward) {
            _ = msgBody.loadRef();
        }

        var totalFee = domTreasuryFee + daoTreasuryFee + gasPoolFee;
        var totalSpend = jettonAmount + totalFee;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);

        // Нужно TON минимум на 3 служебных сообщения.
        assert(
            msgValue >= MIN_TON_FOR_STORAGE * 3,
            ERROR_INSUFFICIENT_GAS
        );

        var feeMsgValue = MIN_TON_FOR_STORAGE;
        var mainMsgValue = msgValue - feeMsgValue * 3;

        balance -= totalSpend;
        saveData();

        // 1) Основной перевод
        sendInternalTransfer(
            toOwner,
            jettonAmount,
            ownerAddress,
            responseDestination,
            queryId,
            mainMsgValue
        );

        // 2) DOM Treasury
        sendInternalTransfer(
            domTreasuryAddress,
            domTreasuryFee,
            ownerAddress,
            ownerAddress,
            queryId + 1,
            feeMsgValue
        );

        // 3) DAO Treasury
        sendInternalTransfer(
            daoTreasuryAddress,
            daoTreasuryFee,
            ownerAddress,
            ownerAddress,
            queryId + 2,
            feeMsgValue
        );

        // 4) Gas Pool (вернёт TON владельцу)
        sendInternalTransfer(
            gasPoolAddress,
            gasPoolFee,
            ownerAddress,
            ownerAddress,
            queryId + 3,
            feeMsgValue
        );

        return;
    }

    // =====================================================
    // OP_BURN — сжечь токены (только owner)
    // =====================================================
    if (op == OP_BURN) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadMsgAddress();

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

        balance -= burnAmount;
        saveData();

        var body = beginCell()
            .storeUint(OP_BURN_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(burnAmount)
            .storeSlice(ownerAddress)
            .storeSlice(responseDestination)
            .endCell();

        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(masterAddress)
            .storeCoins(msgValue)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();

        sendRawMessage(msg, 1);

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getWalletData(): (int, slice, slice, slice, slice, slice) {
    loadData();

    return (
        balance,
        ownerAddress,
        masterAddress,
        domTreasuryAddress,
        daoTreasuryAddress,
        gasPoolAddress
    );
}