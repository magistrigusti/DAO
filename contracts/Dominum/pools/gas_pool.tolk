import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global treasuryPoolAddress: address;
global masterAddress: address;
global jettonWalletCode: cell;
global masterConfigured: bool;

global taxMultiplier: int;

global totalReceivedDom: int;
global totalSpentNanograms: int;
global totalExecuted: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    treasuryPoolAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
    masterConfigured = ds.loadBool();

    taxMultiplier = ds.loadUint(16);

    totalReceivedDom = ds.loadCoins();
    totalSpentNanograms = ds.loadCoins();
    totalExecuted = ds.loadUint(64);
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(treasuryPoolAddress)
            .storeAddress(masterAddress)
            .storeRef(jettonWalletCode)
            .storeBool(masterConfigured)
            .storeUint(taxMultiplier, 16)
            .storeCoins(totalReceivedDom)
            .storeCoins(totalSpentNanograms)
            .storeUint(totalExecuted, 64)
            .endCell()
    );
}

fun requireTreasuryPool(senderAddress: address) {
    assert(senderAddress == treasuryPoolAddress, ERROR_NOT_OWNER);
}

fun requireMasterConfigured() {
    assert(masterConfigured, ERROR_PROXY_NOT_CONFIGURED);
}

fun initMasterConfig(
    newMasterAddress: address,
    newJettonWalletCode: cell
) {
    assert(!masterConfigured, ERROR_ALREADY_INITIALIZED);
    assert(totalReceivedDom == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalSpentNanograms == 0, ERROR_ALREADY_INITIALIZED);
    assert(totalExecuted == 0, ERROR_ALREADY_INITIALIZED);

    masterAddress = newMasterAddress;
    jettonWalletCode = newJettonWalletCode;
    masterConfigured = true;

    saveData();
}

fun buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(treasuryPoolAddress)
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

fun calculateFee(): int {
    var feeDom = DOM_TRANSFER_GRAMS_BASE *
        INITIAL_DOM_PER_GRAM *
        taxMultiplier /
        NANOGRAMS_PER_GRAM /
        TAX_MULTIPLIER_DENOM;

    if (feeDom < MIN_DOM_TRANSFER_FEE) {
        feeDom = MIN_DOM_TRANSFER_FEE;
    }

    if (feeDom > MAX_DOM_TRANSFER_FEE) {
        feeDom = MAX_DOM_TRANSFER_FEE;
    }

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

    var walletBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(fromOwner)
        .storeAddress(fromOwner)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var treasuryBody = beginCell()
        .storeUint(OP_TREASURY_DELIVER, 32)
        .storeUint(queryId, 64)
        .storeAddress(toWallet)
        .storeRef(stateInit)
        .storeRef(walletBody)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(BASE_GRAMS_COST)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(treasuryBody)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendDomFromPoolWallet(
    amount: int,
    queryId: int
) {
    var poolWallet = buildWalletAddress(contract.getAddress());

    var body = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(treasuryPoolAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(poolWallet)
        .storeCoins(MIN_GRAMS_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun sendTreasurySettlement(
    success: bool,
    queryId: int
) {
    var body = beginCell()
        .storeUint(OP_TREASURY_SETTLE, 32)
        .storeUint(queryId, 64)
        .storeBool(success)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 64);
}

fun executeTransfer(
    senderWallet: address,
    jettonAmount: int,
    toOwner: address,
    fromOwner: address,
    paidFeeDom: int,
    queryId: int
) {
    if (!masterConfigured) {
        sendTreasurySettlement(false, queryId);
        return;
    }

    var expectedWallet = buildWalletAddress(fromOwner);
    var myBalance = contract.getOriginalBalance();

    if (senderWallet != expectedWallet) {
        sendTreasurySettlement(false, queryId);
        return;
    }

    if ((jettonAmount <= 0) | (paidFeeDom <= 0)) {
        sendTreasurySettlement(false, queryId);
        return;
    }

    var expectedFeeDom = calculateFee();

    if (paidFeeDom != expectedFeeDom) {
        sendTreasurySettlement(false, queryId);
        return;
    }

    var gramsBudget = BASE_GRAMS_COST * 2;

    if (myBalance < gramsBudget + MIN_GRAMS_FOR_STORAGE) {
        sendTreasurySettlement(false, queryId);
        return;
    }

    sendInternalTransfer(
        toOwner,
        jettonAmount,
        fromOwner,
        queryId + 1
    );

    sendInternalTransfer(
        contract.getAddress(),
        expectedFeeDom,
        fromOwner,
        queryId + 2
    );

    totalSpentNanograms = totalSpentNanograms + gramsBudget;
    totalExecuted = totalExecuted + 1;

    saveData();
    sendTreasurySettlement(true, queryId);
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

    if (op == OP_INIT_MASTER_CONFIG) {
        requireTreasuryPool(senderAddress);

        var newMasterAddress = msgBody.loadAddress();
        var newJettonWalletCode = msgBody.loadRef();

        initMasterConfig(
            newMasterAddress,
            newJettonWalletCode
        );

        return;
    }

    if (op == OP_GAS_POOL_EXECUTE) {
        requireTreasuryPool(senderAddress);

        var senderWallet = msgBody.loadAddress();
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadAddress();
        var fromOwner = msgBody.loadAddress();
        var paidFeeDom = msgBody.loadCoins();

        executeTransfer(
            senderWallet,
            jettonAmount,
            toOwner,
            fromOwner,
            paidFeeDom,
            queryId
        );

        return;
    }

    if (op == OP_TRANSFER_NOTIFICATION) {
        requireMasterConfigured();

        var poolWallet = buildWalletAddress(contract.getAddress());

        assert(senderAddress == poolWallet, ERROR_NOT_VALID_WALLET);

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
        requireMasterConfigured();

        var amount = msgBody.loadCoins();

        assert(amount > 0, ERROR_INVALID_AMOUNT);

        sendDomFromPoolWallet(amount, queryId);
        return;
    }

    throw(0xfff);
}

get fun getGasPoolData(): (
    address, address, bool, int, int, int, int, int
) {
    loadData();

    return (
        treasuryPoolAddress,
        masterAddress,
        masterConfigured,
        taxMultiplier,
        totalReceivedDom,
        totalSpentNanograms,
        totalExecuted,
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

get fun getDomTransferFee(): int {
    loadData();

    return calculateFee();
}
