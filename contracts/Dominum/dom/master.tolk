import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// JETTON MASTER — Главный контракт токена DOM (TEP-74)
// =====================================================
// Минт: только от minterAddress (жёстко при деплое!)
// Админа НЕТ — контракт неизменяем!
//
// Распределение минта (4 гивера):
// - 30% Allodium  → FRS + Foundation
// - 20% DeFi     → Foundry + Market Maker
// - 25% DAO      → Bank DAO + DAO Foundation
// - 25% Dominum  → Bank Dominum + Dominum Foundation
//
// Wallet storage:
// (balance, owner, master, gasProxy, walletCode)
// =====================================================

// Доли минта
const SHARE_ALLODIUM: int = 30;
const SHARE_DEFI: int = 20;
const SHARE_DAO: int = 25;
const SHARE_DOMINUM: int = 25;

const SHARE_TOTAL: int =
    SHARE_ALLODIUM
    + SHARE_DEFI
    + SHARE_DAO
    + SHARE_DOMINUM;

global totalSupply: int;

global minterAddress: slice;
global gasPoolAddress: slice;

global giverAllodiumAddress: slice;
global giverDefiAddress: slice;
global giverDaoAddress: slice;
global giverDominumAddress: slice;

global content: cell;
global jettonWalletCode: cell;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();

    totalSupply = ds.loadCoins();

    minterAddress = ds.loadMsgAddress();
    gasPoolAddress = ds.loadMsgAddress();

    var givers = ds.loadRef().beginParse();

    giverAllodiumAddress = givers.loadMsgAddress();
    giverDefiAddress = givers.loadMsgAddress();
    giverDaoAddress = givers.loadMsgAddress();
    giverDominumAddress = givers.loadMsgAddress();

    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    var givers = beginCell()
        .storeSlice(giverAllodiumAddress)
        .storeSlice(giverDefiAddress)
        .storeSlice(giverDaoAddress)
        .storeSlice(giverDominumAddress)
        .endCell();

    setContractData(
        beginCell()
            .storeCoins(totalSupply)
            .storeSlice(minterAddress)
            .storeSlice(gasPoolAddress)
            .storeRef(givers)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS
// -----------------------------------------------------

fun calculateWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(myAddress())
        .storeSlice(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun calculateWalletStateInit(owner: slice): cell {
    var walletData = calculateWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun calculateWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// -----------------------------------------------------
// MINT
// -----------------------------------------------------

fun sendToWallet(
    toOwner: slice,
    jettonAmount: int,
    queryId: int,
    msgValue: int
) {
    var stateInit = calculateWalletStateInit(toOwner);
    var walletAddress = calculateWalletAddress(stateInit);

    var msgBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(myAddress())
        .storeSlice(toOwner)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(walletAddress)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

fun mintJettons(amount: int, queryId: int, msgValue: int) {
    assert(
        totalSupply + amount <= MAX_SUPPLY,
        ERROR_LIMIT_EXCEEDED
    );

    assert(SHARE_TOTAL == 100, ERROR_INVALID_AMOUNT);

    totalSupply = totalSupply + amount;

    var amountAllodium = amount * SHARE_ALLODIUM / 100;
    var amountDefi = amount * SHARE_DEFI / 100;
    var amountDao = amount * SHARE_DAO / 100;

    var amountDominum = amount
        - amountAllodium
        - amountDefi
        - amountDao;

    // TON делим на 4 отправки
    var tonPer = msgValue / 4;
    var tonRemainder = msgValue - tonPer * 4;

    sendToWallet(
        giverAllodiumAddress,
        amountAllodium,
        queryId,
        tonPer + tonRemainder
    );

    sendToWallet(
        giverDefiAddress,
        amountDefi,
        queryId + 1,
        tonPer
    );

    sendToWallet(
        giverDaoAddress,
        amountDao,
        queryId + 2,
        tonPer
    );

    sendToWallet(
        giverDominumAddress,
        amountDominum,
        queryId + 3,
        tonPer
    );

    saveData();
}

// -----------------------------------------------------
// MESSAGES
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
    // OP_MINT — только от Minter (жёстко!)
    // =====================================================
    if (op == OP_MINT) {
        assert(
            senderAddress.equalSlices(minterAddress),
            ERROR_NOT_MINTER
        );

        var amount = msgBody.loadCoins();
        assert(amount > 0, ERROR_INVALID_AMOUNT);

        mintJettons(amount, queryId, msgValue);
        return;
    }

    // =====================================================
    // OP_BURN_NOTIFICATION — уменьшение totalSupply
    // =====================================================
    if (op == OP_BURN_NOTIFICATION) {
        var burnAmount = msgBody.loadCoins();
        var fromOwner = msgBody.loadMsgAddress();

        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromOwner)
        );

        assert(
            senderAddress.equalSlices(expectedWallet),
            ERROR_NOT_VALID_WALLET
        );

        totalSupply = totalSupply - burnAmount;
        saveData();

        var responseAddress = msgBody.loadMsgAddress();

        if (~responseAddress.isAddressNone()) {
            var msg = beginCell()
                .storeUint(0x10, 6)
                .storeSlice(responseAddress)
                .storeCoins(0)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                .storeUint(OP_EXCESSES, 32)
                .storeUint(queryId, 64)
                .endCell();

            sendRawMessage(msg, 64 + 2);
        }

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getJettonData(): (int, int, slice, cell, cell) {
    loadData();

    return (
        totalSupply,
        -1,
        minterAddress,
        content,
        jettonWalletCode
    );
}

get fun getWalletAddress(ownerAddress: slice): slice {
    loadData();

    var stateInit = calculateWalletStateInit(ownerAddress);
    return calculateWalletAddress(stateInit);
}

get fun getMasterData(): (slice, slice) {
    loadData();

    return (
        minterAddress,
        gasPoolAddress
    );
}

get fun getGiversData(): (slice, slice, slice, slice) {
    loadData();

    return (
        giverAllodiumAddress,
        giverDefiAddress,
        giverDaoAddress,
        giverDominumAddress
    );
}
