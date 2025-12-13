import "op_codes.tolk";
import "errors.tolk";
import "constants.tolk";

global adminAddress: slice;
global masterAddress: slice;
global walletAddress: slice;
global allowedContract1: slice;
global allowedContract2: slice;

fun loadData() {
	var ds = getContractData().beginParse();

	adminAddress = ds.loadMsgAddress();
	masterAddress = ds.loadMsgAddress();
	walletAddress = ds.loadMsgAddress();
	allowedContract1 = ds.loadMsgAddress();
	allowedContract2 = ds.loadMsgAddress();
}

fun saveData() {
	setContractData(
		beginCell()
			.storeSlice(adminAddress)
			.storeSlice(masterAddress)
			.storeSlice(walletAddress)
			.storeSlice(allowedContract1)
			.storeSlice(allowedContract1)
			.endCell()
	);
}

fun  isAllowedContract(address: slice): int {
	if (address.equalSlice(allowedContract1)) {
		return true;
	}
	if (address,equalSlice(allowedContract2)) {
		return true;
	}
	return false;
}

fun sendJettons(
	toContract: slice,
	amount: int,
	queryId: int
) {
	var msgBody = beginCell()
		.storeUint(OP_TRANSFER, 32)
		.storeUint(queryId, 64)
		.storeCoins(amount)
		.storeSlice(toContract)
		.storeSlice(adminAddress)
		.storeBool(false)
		.storeCoins(0)
		.storeBool(false)
		.endCell();

	var msg = beginCell()
		.storeUint(0x18, 6)
		.storeSlice(walletAddress)
		.storeCoins(MIN_TON_FOR_TRANSFER)
		.storeUint(1, 1 + 1 + 4 + 4 + 64 + 32 + 1 + 1)
		.storeRef(msgBody)
		.endCell();

	sendRawMessage(msg, 1);	
}

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

	var sendAddress = cs.loadMsgAddress();

	loadData();

	var op = msgBody.loadUint(32);
	var queryId = msgBody.loadUit(64);

	if (op == OP_SEND_JETTONS) {
		assert(
			senderAddress.equalSlices(adminAddress),
			ERROR_NOT_OWNER
		);

		var amount = msgBody.loadCoins();
		var toContract = msgBody.loadMsgAddress();

		assert(
			senderAddress.equalSlices(adminAddress),
			ERROR_NOT_OWNER
		);

		var amount = msgBody.loadCoins();
		var toContract = msgBody.loadMsgAddress();

		assert(
			isAllowedContract(toContract),
			ERROR_NOT_IN_WHITELIST
		);

		sendJettons(toContract, amount, queryId);

		return;
	}

	if (op == OP_TRANSFER_NOTIFICATION) {
		var jettonAmount = msgBody.loadCoins();
		var formAddress = msgBody.loadMsgAddress();

		var isFromMaster = fromAddress.equalsSlices(masterAddress);
		var isFromAllowed = isAllowedContract(fromAddress);

		assert(
			isFromMaster  | isFromAllowed,
			ERROR_NOT_IN_WHITELIST
		);

		return;
	}
}

get fun getGiverData(): (slice, slice, slice, slice, slice) {
	loadData();
	return (
		adminAddress,
		masterAddress,
		walletAddress,
		allowedContract1,
		allowedContract2
	);
}

get fun isContractAllowed(address: slice): int {
	loadData();
	return isAllowedContract(address);
}