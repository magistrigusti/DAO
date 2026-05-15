import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global treasuryPoolAddress: address;
global masterAddress: address;
global jettonWalletCode: cell;

global taxMultiplier: int,

global totalReceivedDom: int;
global totalSpentTon: int;
global totalExecuted: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    treasuryPoolAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();

    taxMultiplier = ds.loadUint(16);

    totalReceivedDom = ds.loadCoins();
    totalSpentTon = ds.loadCoins();
    totalExecuted = ds.loadUint(64);
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(treasuryPoolAddress)
            .storeAddress(masterAddress)
            .storeRef(jettonWalletCode)
            .storeUint(taxMultiplier, 16)
            .storeCoins(totalReceivedDom)
            .storeCoins(totalSpentTon)
            .storeUint(totalExecuted, 64)
            .endCell()
    );
}

fun requireTreasuryPool(senderAddress: address) {
    assert(senderAddress = treasuryPoolAddress, ERROR_NOT_OWNER);
}

fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(contract.getAddress())
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

fun buildWalletAddress(owner: address): address {
    var stateInit = buildWalletStateInit(owner);
    var wc = contract.getAddress().getWorkchain();

    return address.fromWorkchainAndHash(
        wc,
        stateInit.hash()
    );
}

fun calculateFee(maxFeeDom: int): int {
    var feeDom = MIN_DOM_TRANSFER_FEE * taxMultiplier / TAX_MULTIPLIER_DENOM;

    if (feeDom < MIN_DOM_TRANSFER_FEE) {
        feeDom = MIN_DOM_TRANSFER_FEE;
    }

    if (feeDom > MAX_DOM_TRANSFER_FEE) {
        feeDom = MAX_DOM_TRANSFER_FEE;
    }

    assert(feeDom <= maxFeeDom, ERROR_INSUFFICIENT_BALANCE);

    return feeDom;
}

fun sendInternalTransfer(
    toOwner: address,
    amount: int,
    fromOwner: address,
    queryId: int
) {
    if (amount <= 0) {
        return;
    }

    var stateInit = buildWalletStateInit(toOwner);
    var toWallet = buildWalletAddress(toOwner);

    var body = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeAddress(fromOwner)
        .storeCoins(0)
        .storeBool(false)
        .endell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(toWallet)
        .storeCoins(BASE_TON_COST)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit)
        .storeRef(body)
        .endell();

    sendRawMessage(msg, 1);
}

fun sendDomFromPoolWallet(
    amount: int,
    queryId: int
) {
    var poolWallet = buildWalletAddress(contract.getAddress());

    var body = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(treasuryPoolAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(poolWallet)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun executeTransfer(
    senderWallet: address,
    jettonAmount: int,
    toOwner: address,
    fromOwner: address,
    maxFeeDom: int,
    queryId: int
) {
    var expectedWallet = buildWalletAddress(fromOwner);
    var myBalance = contract.getOriginalBalance();

    assert(senderWallet == expectedWallet, ERROR_NOT_VALID_WALLET);
    assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
    assert(maxFeeDom > 0, ERROR_INVALID_AMOUNT);

    var feeDom = calculateFee(maxFeeDom);
    var refundDom = maxFeeDom - feeDom;

    var tonBudget = BASE_TON_COST * 3;
    assert(myBalance >= tonBudget + MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);

    sendInternalTransfer(
        toOwner,
        jettonAmount,
        fromOwner,
        query + 1
    );

    sendInternalTransfer(
        contract.getAdress(),
        feeDom,
        fromOwner,
        queryId + 2
    );

    if (refundDom > 0) {
        sendInternalTransfer(
            fromOwner,
            refundDom,
            fromOwner,
            queryId + 3
        );
    }

    totalSpendTon = totalSpentTon + tonBudget;
    totalExecuted = totalExecuted + 1;

    saveData();
}

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    if (op == OP_GAS_POOL_EXECUTE) {
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var maxFeeDom = msgBody.loadCoins();

        executeTransfer(
            senderAddress,
            jettonAmount,
            toOwner,
            fromOwner,
            maxFeeDom,
            queryId
        );

        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        var poolWallet = buildWalletAddress(contract.getAdress());

        assert(senderAddress == poolWallet, ERROR_NOTVALID_WALLET);

        var amount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        totalReceivedDom = totalReceivedDom + amount;
        saveData();
        return;
    }

    if (op == OP_CHANGE_TAX) {
        requireTreasuryPool(senderAddress);

        var newTaxMultiplier = msgBody.loadUint(16);

        assert(newTaxMultiplier >= MIN_TAX_MULTIPLIER, ERROR_INVALID_AMOUNT);
        assert(newTaxMultiplier <= MAX_TAX_MULTIPLIER, ERROR_LIMIT_EXCEEDED);

        taxMultiplier = newTaxMultiplier;
        saveData();
        return;
    }

    if (op == OP_TOP_UP) {
        requireTreasuryPool(senderAddress);
        return;
    }

    if (op == OP_WITHDRAW_DOM) {
        requireTreasuryPool(senderAddress);
        var amount = msgBody.loadCoins();

        assert(amount > 0, ERROR_INVALIUD_AMOUNT);

        sendDomFromPoolWallet(amount, queryId);
        return;
    }

    throw(0xfff);
}

get fun getGasPoolData(): (
    address, address, int, int, int, int, int
) {
    loadData();

    return (
        treasuryPoolAddress,
        masterAddress,
        taxMultiplier,
        totalReceivedDom,
        totalSpentTon,
        totalExcuted,
        contract.getOriginalBalance()
    );
}

get fun getPoolWalletAddress(): address {
    loadData();

    return buildWalletAddress(contract.getAddress());
}

get fun getWalletAddress(owner: address): address {
    loadData();

    return buildWalletAddress(owner);
}