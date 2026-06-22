// =====================================================
// MASTER ALLOD — Jetton Master с FRS allowance
// =====================================================
// 1) FRS увеличивает mintAllowancePool
// 2) Owner минтит ALLOD только в рамках allowance
// 3) Burn из wallet уменьшает supply и шлет OP_ALLOD_BURNED в FRS
// =====================================================

import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// STORAGE
// =====================================================
global totalSupply: int;

global ownerAddress: address;        // кто вызывает OP_MINT
global frsAddress: address;          // только FRS может increase allowance
global gasPoolAddress: address;      // AllodGasPool исполняет переводы и принимает ALLOD fee

global mintAllowancePool: int;     // доступный лимит минта ALLOD

global content: cell;
global jettonWalletCode: cell;

// =====================================================
// LOAD / SAVE
// =====================================================
fun loadData() {
    var ds = contract.getData().beginParse();

    totalSupply = ds.loadCoins();

    ownerAddress = ds.loadAddress();
    frsAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();

    mintAllowancePool = ds.loadCoins();

    content = ds.loadRef();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(totalSupply)
            .storeAddress(ownerAddress)
            .storeAddress(frsAddress)
            .storeAddress(gasPoolAddress)
            .storeCoins(mintAllowancePool)
            .storeRef(content)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// =====================================================
// WALLET ADDRESS
// =====================================================
fun calculateWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(contract.getAddress())
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun calculateWalletStateInit(owner: address): cell {
    var walletData = calculateWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun calculateWalletAddress(stateInit: cell): address {
    var workchain = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        workchain,
        stateInit.hash()
    );
}

// =====================================================
// SEND MINT TO WALLET
// =====================================================
fun sendToWallet(
    toOwner: address,
    jettonAmount: int,
    queryId: int,
    msgValue: int
) {
    var stateInit = calculateWalletStateInit(toOwner);
    var walletAddress = calculateWalletAddress(stateInit);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(contract.getAddress())
        .storeAddress(toOwner)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(walletAddress)
        .storeCoins(msgValue)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

// =====================================================
// SEND BURN NOTICE TO FRS
// =====================================================
fun sendAllodBurnedToFrs(burnAmount: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_ALLOD_BURNED, 32)
        .storeUint(queryId, 64)
        .storeCoins(burnAmount)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(frsAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

// =====================================================
// MAIN
// =====================================================
fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_INCREASE_MINT_ALLOWANCE — только от FRS
    // =====================================================
    if (op == OP_INCREASE_MINT_ALLOWANCE) {
        assert(
            senderAddress == frsAddress,
            ERROR_NOT_FRS
        );

        var allowanceAmount = msgBody.loadCoins();
        assert(allowanceAmount > 0, ERROR_INVALID_AMOUNT);

        mintAllowancePool = mintAllowancePool
            + allowanceAmount;

        saveData();
        return;
    }

    // =====================================================
    // OP_MINT — минт в конкретный wallet (только owner)
    // =====================================================
    if (op == OP_MINT) {
        assert(
            senderAddress == ownerAddress,
            ERROR_NOT_OWNER
        );

        var toOwner = msgBody.loadAddress();
        var mintAmount = msgBody.loadCoins();

        assert(mintAmount > 0, ERROR_INVALID_AMOUNT);
        assert(
            mintAmount <= mintAllowancePool,
            ERROR_LIMIT_EXCEEDED
        );
        assert(
            msgValue >= MIN_TON_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );

        mintAllowancePool = mintAllowancePool - mintAmount;
        totalSupply = totalSupply + mintAmount;
        saveData();

        sendToWallet(
            toOwner,
            mintAmount,
            queryId,
            msgValue
        );

        return;
    }

    // =====================================================
    // OP_BURN_NOTIFICATION — от wallet
    // =====================================================
    if (op == OP_BURN_NOTIFICATION) {
        var burnAmount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();

        var expectedWallet = calculateWalletAddress(
            calculateWalletStateInit(fromOwner)
        );

        assert(
            senderAddress == expectedWallet,
            ERROR_NOT_VALID_WALLET
        );

        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(totalSupply >= burnAmount, ERROR_INSUFFICIENT_BALANCE);

        totalSupply = totalSupply - burnAmount;
        saveData();

        // Уведомляем FRS для разблокировки DOM
        sendAllodBurnedToFrs(burnAmount, queryId);

        var responseAddress = msgBody.loadAddressOpt();

        if (responseAddress != null) {
            var msg = beginCell()
                .storeUint(0x10, 6)
                .storeAddress(responseAddress)
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

// =====================================================
// GETTERS
// =====================================================
get fun getJettonData(): (int, int, address, cell, cell) {
    loadData();

    return (
        totalSupply,
        -1,
        ownerAddress,
        content,
        jettonWalletCode
    );
}

get fun getWalletAddress(ownerAddressValue: address): address {
    loadData();

    var stateInit = calculateWalletStateInit(ownerAddressValue);
    return calculateWalletAddress(stateInit);
}

get fun getMasterData(): (address, address, address, int, int) {
    loadData();

    return (
        ownerAddress,
        frsAddress,
        gasPoolAddress,
        mintAllowancePool,
        totalSupply
    );
}
