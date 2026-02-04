import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: slice;
global jettonWalletAddress: slice;

global bankDaoAddress: slice;
global bankDefiAddress: slice;
global bankDominumAddress: slice;

fun loadData() {
    var ds = getContractData().beginParse();

    ownerAddress = ds.loadMsgAddress();
    jettonWalletAddress = ds.loadMsgAddress();

    bankDaoAddress = ds.loadMsgAddress();
    bankDefiAddress = ds.loadMsgAddress();
    bankDominumAddress = ds.loadMsgAddress();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(ownerAddress)
            .storeSlice(jettonWalletAddress)
            .storeSlice(bankDaoAddress)
            .storeSlice(bankDefiAddress)
            .storeSlice(bankDominumAddress)
            .endCell()
    );
}

fun isWitelisted(address: slice): int {
    if (address.equalsSlices(bankDominumAddress)) {
        return true;
    }
    if (address.equalSlices(bankDefiAddresss)) {
        return true;
    }
    if (address.equalSlices(bankDominumAddress)) {
        return true;
    }
    return false;
}

fun withdrawTon(toAddress: slice, amount: int, queryId: int) {
    var body = beginCell()
        .storeUint(OP_EXESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(toAddress)
        .storeCoins(amount)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();

    sendRawMessage(msg, 1);
}

fun withdrawDom(toAddress: slice, amount: int, queryId: int) {
    var msgBody = beginCell()
        .storeUint(OP_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(toAddress)
        .storeSlice(ownerAddress)
        .storeBool(false)
        .storeCoins(0)
        .storeBool(false)
        .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(jettonWalletAddress)
        .storeCoins(MIN_TON_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody)
        .endCell();

    sendRawMessage(msg, 1);
}

fun onInternalMesage(
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        return;
    }

    if (op == OP_WITHDRAW) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);

        withdrawTon(toAddress, amount, queryId);

        return;
    }

    if (op == OP_WITHDRAW_JETTONS) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            EROR_NOT_OWNER
        );

        var amount = msgBody.loadCoins();
        var toAddress = msgBody.loadMsgAddress();

        assert(isWhitelisted(toAddress), ERROR_NOT_IN_WHITELIST);

        withdrawDom(toAddress, amount, queryId);

        return;
    }

    throw(0xffff);
}

get fun getTresuryData(): (slice, slice, slice, slice, slice, int) {
    loadData();

    return (
        ownerAddress,
        jettonWalletAddress,
        bankDaoAddress,
        bankDefiAddress,
        bankDominumAddress,
        getBalance().0
    );
}

get fun isAddressWhitelisted(address: slice): int {
    loadData();
    return isWhitelisted(address);
}