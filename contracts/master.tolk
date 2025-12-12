import "op_codes.tolk"
import "errors.tolk"
import "constants.tolk"

global totalSupply: int; 
global minterAddress: slice;
global treasuryAddress: slice;
global fondationAddress: slice;

global giver1Address: slice;
global giver2Address: slice;
global giver3Address: slice; 

global content: cell;
global jettonWalletCode: cell;

fun loadData() {
	var ds = getContractData().beginParse();

	totalSupply = ds.loadCoins();
	minterAddress = ds.loadMsgAddress();
	treasuryAddress = ds.loadMsgAddress();
	foundationAddress = ds.loadMsgAddress();

	var giversCell = ds.loadRef().beginParse();
	giver1Address = giversCell.loadMsgAddress();
	giver2Address = giversCell.loadMsgAddress();
	giver3Address = giversCell.loadMsgAddress();

	content = ds.loadRef();
	jettonWalletCode = ds.loadRef();
}

fun saveData() {
	var giversCell = beginCell()
		.storeSlice(giver1Address)
		.storeSlice(giver2Address)
		.storeSlice(giver3Address)
		.endCell();

	setContractData(
		beginCell()
			.storeCoins(totalSupply)
			.storeSlice(minterAddress)
			.storeSlice(treasuryAddress)
			.storeSlice(fondationAddress)
			.storeRef(giversCell)
			.storeRef(content)
			.storeRef(jettonWalletCode)
			.endCell()
	);
}

func calculateWalletStateInit(ownerAddress: slice): cell {
	var walletData = beginCell();
		.storeCoins(0)
		.storeSlice(ownerAddress)
		.storeSlice(myAddress())
		.storeSlice(fondationAddress)
		.storeSlice(treasureAddress)
		.endCell();

	return beginCell()
		.storeUint(0, 2)
		.storeMaybeRef(jettonWalletCode)
		.storeBaybeRef(walletData)
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

fun sendToWallet(
	toAddress: slice,
	amount: int,
	queryId: int,
	msgValue: int
) {
	var stateInit = calculateWalletStateInit(toAddress);
	var walletAddress = calculateWalletAddress(stateInit);

	var msgBody = beginCell()
		.storeUint(OP_INTERNAL_TRANSFER, 32)
		.storeUint(queryId, 64)
		.storeCoins(amount)
		.storeSlice(myAddress())
		.storeSlice(toAddress)
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

fun mintTokens(amount: int, queryId: int, msgValue: int) {
	assert(
		totalSupply + amount <= MAX_SUPPLY,
		ERROR_LIMIT_EXCEEDED
	);

	totalSupply = totalSupply + amount;

	var amountPerGiver = amount / GIVERS_COUNT;
	var remainder = amount % GIVERS_COUNT;

	var tonPerTransfer = msgValue / GIVER_COUNT;

	sendToWallet(
		giver1Address,
		amountPerGiver + remainder,
		queryId,
		tinPerTransfer
	);

	sendToWallet(
		giver2Address,
		amountPerGiver,
		queryId,
		tonPerTransfer
	);

	sendToWallet(
		giver3Address,
		amountPerGiver,
		queryId,
		tonPerTransfer
	);

	saveData();
}

fun onInternalMessage(
	myBalance: int,
	msgValue: int,
	msgFul: cell,
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

	if (op == OP_MINT) {
		asser(
			senderAddress.equalSlices(minterAddress),
			ERROR_NOT_MINTER
		);

		var amount = msgBody.loadCoins();

		assert(amount > 0, ERROR_INVALID_AMOUNT);

		mintTokens(amount, queryId, msgValue);

		return;
	}

	if (op == OP_BURN_NOTIFICATION) {
		var burnAmount = msgBody.loadCoins();
		var formAddress = msgBody.loadMsgAddress();

		var expectedWallet = calculateWalletAddress(
			calculateWalletStateInit(fromAddress)
		);

		assert(
			senderAddress.equalSlices(expectedWallet),
			ERROR_NOT_VALID_WALLET
		);

		totalSupply = totalSupply - burnAmount;

		saveData();

		var responseAddress = msgBody.loadMsgAddress();
		
	}
}