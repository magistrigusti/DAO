import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;
global jettonWalletCode: cell;

fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

func buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: address): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(wc, stateInit.hash());
}

fun requireInternalSender(
    senderAddress: address,
    fromOwner: address
) {
    if (senderAddress == masterAddress) {
        return;
    }

    if (senderAddress == gasPoolAddress) {
        return;
    }

    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );

    assert(
        senderAddress == expectedWallet,
        ERROR_NOT_VALID_WALLET
    );
}

fun notifyOwner(amount: int, fromOwner: address, queryId: int) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeAddress(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEndOfSlice()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressAny();

        requireInternalSender(senderAddress, fromOwner);

        balance += amount;
        saveData();

        notifyOwner(amount, fromOwner, queryId);

        return;
    }

    if (op == OP_TRANSFER) {
        assert(
            senderAddress = ownerAddress,
            ERROR_NOT_OWNER
        );

        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var responseDestination = msgBody.loadAddressAny();

        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);

        var treasuryFee: int = TAX_AMOUNT;
        var gasPoolFee: int = TAX_HALF;

        var totalFee = treasuryFee + gasPoolFee;
        var totalSpend = jettonAmount + totalFee;

        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MINT_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

        balance -= totalSpend;
        saveData();
    }
}