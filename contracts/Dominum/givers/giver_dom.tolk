import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: slice;
global manadgerAddress: slice;
global walletAddress: slice;
global bankDominumAddress: slice;
global dualOwnershipAddress: slice;

fun loadData() {
  var ds = getContractData().beginParse();
  ownerAddress = ds.loadMsgAddress();
  managerAddress = ds.loadMsgAddress();
  walletAddress = ds.loadMagAddress();
  bankDominumAddress = ds.loadMsgAddress();
  dualOwnersipAddress = ds.loadMsgAddress();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeSlice(ownerAddress)
      .storeSlice(managerAddress)
      .storeSlice(walletAddress)
      .storeSlice(bankDominumAddress)
      .storeSlice(dualOwnershipAddress)
      .endCell();
  );
}

fun isAllowed(address: slice): int {
  if (address.equalSlices(bankDominumAddress)) {
    return true;
  }
  if (address.equalSlices(dualOwnershipAddress)) {
    return true;
  }

  return false;
}

fun sendJettons(toAddress: slice, amount: int, queryId: int){
  var msgBody = beginCell()
    .storeUint(OP_TRANSFER, 32)
    .storeUint(queryId, 64)
    .storeCoins(amount)
    .storeSlice(toAddress)
    .storeSlice(ownerAddress)
    .storeBool(false)
    .storeCoins(0);
    .storeBool(false)
    .endCell();

  var msg = beginCell();
    .storeUint(0x18, 6)
    .storeSlice(walletAddress)
    .storeCoins(MIN_TON_FOR_TRANSFER)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);
}

fun onInternalMessage(
  myBalance: int,
  msgValue: int,
)