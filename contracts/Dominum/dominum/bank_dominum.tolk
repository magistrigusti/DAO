import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: slice;
global treasuryManagerAddress: slice;

global domWalletAddress: slice;

fun loadData() {
  var ds = getContractData().beginParse();

  ownerAddress = ds.loadMsgAddress();
  treasuryManagerAddress = ds.loadMsgAddress();
  domWalletAddress = ds.loadMsgAddress();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeCell()
        .storeSlice(ownerAddress)
        .storeSlice(treasuryManagerAddress)
        .storeSlice(domWalletAddress)
        .endCell()
  );
}

fun requireOwner(sender: slice) {
  assert(sender.equalSlices(ownerAddress), ERROR_NOT_OWNER);
}

fun sendToTreasuryManager(
  op: int,
  body: cell,
  value: int,
  queryId: int
) {
  var msgBody = beginCell()
    .storeUint(op, 32)
    .storeUint(queryId, 64)
    .storeRef(body)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(treasuryManagerAddress)
    .storeCoins(value)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);
}

fun sendTon(toAddress: slice, amount: int) {
  var msg = beginCell()
    .storeUint(0x10, 6)
    .storeSlice(toAddress)
    .storeCoins(amount)
    .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .endCell();

  sendRawMessage(msg, 1);
}

fun withdrawDomJettons(toAddress: slice, amount:int, queryId: int) {
  var transferBody = beginCell()
    .storeUint(OP_TRANSFER, 32)
    .storeUint(queryId, 64)
    .storeCoins(amount)
    .storeSlice(toAddress)
    .storeSlice(ownerAddress)
    .storeBool(false)
    .storeCoins(0)
    .endCell;

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(domWalletAddress)
    .storeCoins(MIN_TON_FOR_TRANSFER)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(transferBody)
    .endCell();

  sendRawMessage(msg, 1);
}

fun onImternalMessage(
  myBalance: int,
  msgValue: int,
  msgFull: cell,
  msgBody: slice
) {
  if (msgBody.isEndOfSlice()) {
    return;
  }

  
}


