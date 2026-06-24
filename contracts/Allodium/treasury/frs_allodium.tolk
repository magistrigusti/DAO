import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// ========== TOLK MIGRATION v2 ==========
// FRS ALLODIUM — резервная система ALLOD.
// Принимает DOM, блокирует его, даёт ALLOD Master allowance.
// При burn ALLOD разблокирует DOM в Allodium Foundation.
// ========================================

const DOM_TRANSFER_MAX_FEE: int = 3000000;

global ownerAddress: address;
global domWalletAddress: address;
global allodMasterAddress: address;
global giverAllodiumAddress: address;
global allodiumFoundationAddress: address;
global lockedDom: int;

fun loadData() {
    var ds = contract.getData().beginParse();

    ownerAddress = ds.loadAddress();
    lockedDom = ds.loadCoins();

    var protocolAddresses = ds.loadRef().beginParse();
    domWalletAddress = protocolAddresses.loadAddress();
    allodMasterAddress = protocolAddresses.loadAddress();

    var distributionAddresses = ds.loadRef().beginParse();
    giverAllodiumAddress = distributionAddresses.loadAddress();
    allodiumFoundationAddress = distributionAddresses.loadAddress();
}

fun saveData() {
    var protocolAddresses = beginCell()
        .storeAddress(domWalletAddress)
        .storeAddress(allodMasterAddress)
        .endCell();

    var distributionAddresses = beginCell()
        .storeAddress(giverAllodiumAddress)
        .storeAddress(allodiumFoundationAddress)
        .endCell();

    contract.setData(
        beginCell()
            .storeAddress(ownerAddress)
            .storeCoins(lockedDom)
            .storeRef(protocolAddresses)
            .storeRef(distributionAddresses)
            .endCell()
    );
}

fun sendMintAllowance(allowanceAmount: int, queryId: int) {
    if (allowanceAmount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_INCREASE_MINT_ALLOWANCE, 32)
        .storeUint(queryId, 64)
        .storeCoins(allowanceAmount)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(allodMasterAddress)
        .storeCoins(MIN_GRAMS_FOR_STORAGE)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun unlockDom(amount: int, queryId: int) {
    if (amount <= 0) {
        return;
    }

    var body = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(allodiumFoundationAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(DOM_TRANSFER_MAX_FEE)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(domWalletAddress)
        .storeCoins(MIN_GRAMS_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert(senderAddress == domWalletAddress, ERROR_NOT_VALID_WALLET);

        var domAmount = msgBody.loadCoins();
        var fromAddress = msgBody.loadAddress();

        if (fromAddress == contract.getAddress()) {
            return;
        }

        assert(fromAddress == giverAllodiumAddress, ERROR_NOT_IN_WHITELIST);
        assert(domAmount > 0, ERROR_INVALID_AMOUNT);

        lockedDom = lockedDom + domAmount;
        saveData();

        var scaledAllowance = domAmount * EXCHANGE_RATE_DOM_TO_ALLOD;

        assert(
            scaledAllowance % EXCHANGE_DECIMALS_FACTOR == 0,
            ERROR_INVALID_AMOUNT
        );

        var allowanceAmount = scaledAllowance / EXCHANGE_DECIMALS_FACTOR;
        assert(allowanceAmount > 0, ERROR_INVALID_AMOUNT);

        sendMintAllowance(allowanceAmount, queryId);
        return;
    }

    if (op == OP_ALLOD_BURNED) {
        assert(senderAddress == allodMasterAddress, ERROR_NOT_MASTER);

        var burnedAllod = msgBody.loadCoins();
        assert(burnedAllod > 0, ERROR_INVALID_AMOUNT);

        var scaledDom = burnedAllod * EXCHANGE_DECIMALS_FACTOR;

        assert(
            scaledDom % EXCHANGE_RATE_DOM_TO_ALLOD == 0,
            ERROR_INVALID_AMOUNT
        );

        var domToUnlock = scaledDom / EXCHANGE_RATE_DOM_TO_ALLOD;

        assert(domToUnlock > 0, ERROR_INVALID_AMOUNT);
        assert(lockedDom >= domToUnlock, ERROR_INSUFFICIENT_BALANCE);

        lockedDom = lockedDom - domToUnlock;
        saveData();

        unlockDom(domToUnlock, queryId);
        return;
    }

    throw(0xffff);
}

get fun getFrsData(): (
    address, address, address, address, address, int
) {
    loadData();

    return (
        ownerAddress,
        domWalletAddress,
        allodMasterAddress,
        giverAllodiumAddress,
        allodiumFoundationAddress,
        lockedDom
    );
}

get fun getLockedDom(): int {
    loadData();
    return lockedDom;
}

get fun getMaxAllod(): int {
    loadData();
    return lockedDom * EXCHANGE_RATE_DOM_TO_ALLOD / EXCHANGE_DECIMALS_FACTOR;
}
