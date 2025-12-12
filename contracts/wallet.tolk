import "op_codes.tolk";
import "errors.tolk";
import "constants.tolk";

global balance: int;
global ownerAddress: slice;
global masterAddress: slice;
global domTreasuryAddress: slice;
global daoTreasuryAddress: slice;

fun loadData() {
	var ds = getContractData().beginParse();

	balance = ds.loadCoins();
	ownerAddress = ds.loadMsgAddress();
	masterAddress = ds.loadMsgAddress();
	domTreasuryAddress = ds.loadMsgAddress();
	daoTreasuryAddress = ds.loadMsgAddress();
}

fun saveData() {
	setContractData(
		beginCell()
			.storeCoins(balance)
			.storeSlice(ownerAddress)
			.storeSlice(masterAddress)
			.storeSlice(domTreasuryAddress)
			.storeSlice(daoTreasuryAddress)
			.endCell()
	);
}

fun sendTax(queryId: int) {
	var msgDom = beginCell()
		.storeUint(0x10, 6)
		.storeSlice(domTreasuryAddress)
		.storeCoins(TAX_HALF)
		.storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
		.storeUint(OP_RECEIVE_TAX, 32)
		.storeUint(queryId, 64)
		.endCell()

	sendRawMessage(msgDom, 1);

	var msgDao = beginCell()
		.storeUint(0x10, 6)
		.storeSlice(daoTreasuryAddress)
		.storeCoins(TAX_HALF)
		.storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
		.storeUint(OP_RECEIVE_TAX, 32)
		.storeUint(queryId, 64)
		.endCell();

	sendRawMessage(msgDao, 1);
}

fun sendTokens(
	toAddress: slice,
	jettonAmount: int,
	responseAddress: slice,
	queryId: int,
	forwardTomAmount: int,
	forwardPayload: slice
) {
	var msgBody = beginCell()
		.storeUint(OP_INTERNAL_TRANSFER, 32)
		.storeUint(queryId, 64)
		.storeCoins(jettonAmount)
		.storeSlice(ownerAddress)
		.storeSlice(responseAddress)
		.storeCoins(forwardTonAmount)
		.storeSlice(forwardPayload)
		.endCell()

	var msg = beginCell()
		.storeUint(0x18, 6)
		.storeSlice(toAddress)
		.storeCoins(0)
		storeuint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
		.storeRef(msgBody)
		.endCell();

	sendRawMessage(msg, 64)
}

fun onInternalMessage(
	myBalanceL int,
	msgValue: int,
	msgFull: cell,
	msgBody: slice
) {
	if (msgBody.isEndOfSlice()) {
		return;
	}

	var cs = msgFull.beginParse();
	var flags = cs.loadUint(4);

	if (flag & 1) {
		msgBody.skipBits(32);
		var op = msgBody.loadUint(32);

		if (of == OP_INTERNAL_TRANSFER) {
			msgBody.skipBits(64);
			var bouncedAmount = msgBody.loadCoins();

			loadData();
			balance = balance + bouncedAmount;
			saveData();
		}
		return;
	}

	var senderAddress = cs.loadMsgAddress();

	loadData();

	var op = msgBody.loadUint(32);
	var queryId = msgBody.loadUint(64);

	if (op == OP_TRANSFER) {
		assert(
			senderAddress.equalSlices(ownerAddress),
			ERROR_NOT_OWNER
		);

		assert(
			msgValue >= MINT_TON_FOR_TRANSFER,
			ERROR_INSUFFICIENT_GAS
		);

		var jettonAmount = msgBody.loadCoins();
		var toAddress = msgBody.loadMsgAddress();
		var responseAddress = msgBody.loadMsgAddress();
		msgBody.skipBits(1);
		var forwardTonAmount = msgBody.loadCoins();
		var forwardPayload = msgBody;

		asset(
			balance >= jettonAmount,
			ERROR_INSUFFICIENT_BALANCE
		);

		balance = balance - jettonAmount;
		saveData();

		sendTokens(
			toAddress,
			jettonAmount,
			responseAddressm
			queryId,
			forwardTonAmount,
			forwardPayload
		);

		sendTax(queryId);

		return;
	}

	if (op == OP_INTERNAL_TRANSFER) {
		var jettonAmount = msgBody.loadCoins();
		var fromAddress = msgBody.loadMsgAddress();
		var responseAddress = msgBody.loadMsgAddress();
		var forwardTonAmount = msgBody.loadCoins();

		balance = balance + jettonAmount;
		saveData();

		if (forwardTonAmount > 0) {
			var forwardPayload = msgBody;

			var msgNotify = beginCell()
				.storeUint(0x10, 6)
				.storeSlice(ownerAddress)
				.storeCoins(forwardTonAmount)
				.storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
				.storeRef(
					beginCell()
						.storeUint(OP_TRANSFER_NOTIFICATION, 32)
						.storeUint(queryId, 64)
						.storeCoins(jettonAmount)
						.storeSlice(fromAddress)
						.storeSlice(forwardPayload)
						.endCell()
				)
				.endCell();

			sendRawMessage(msgNotify, 1);
		}

		if(~responseAddress.isAddressNote()) {
			var msgExcess = beginCell()
				.storeUint(0x10, 6)
				.storeSlice(responseAddress)
				.storeCoins(0)
				.storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
				.storeUint(OP_EXCESSES, 32)
				.storeUint(queryId, 64)
				.endCell();

			sendRawMessage(msgExces, 64 + 2);
		}

		return;
	}
}