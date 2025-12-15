import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: slice;
global nftCollectionAddress: slice;
global totalBonds: int;
global totalLockedDom: int;
global totalLockedTon: int;

fun loadData() {
  var ds = getContractData().beginParse();
  ownerAddress = ds.loadMsgAddress();
  nftCollectionAddress = ds.loadMsgAddress();
  totalBonds = ds.loadUint(64);
  totalLockedDom = ds.loadCoins();
  totalLockedTon = ds.loadCoins();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeSlice(ownerAddress)
      .storeSlice(nftCollectionAddress)
      .storeUint(totalBonds, 64)
      .storeCoins(totalLockedDom)
      .storeCoins(totalLockedTon)
      .endCell()
  );
}

fun mintBondNft(
  toAddress: slice,
  bondAmount: int,
  couponRate: int,
  maturityDate: int,
  queryId: int
){
  var nftContent = beginCell()
    .storeCoins(bondAmount)
    .storeUint(couponRate, 16)
    .storeUint(matuityDate, 64)
    .storeSlice(toAddress)
    .endCell();

  var msgBody = beginCell()
    .storeUint(OP_MINT_NFT, 32)
    .storeUint(queryId, 64)
    .storeUint(totalBonds, 64)
    .storeCoins(MIN_TON_FOR_STORAGE)
    .storageRef(nftContent)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(nftCollectionAddress)
    .storeCoins(MIN_TON_FOR_STORAGE * 2)
    .storeUint(1, 1 + 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);

  totalBonds += 1;
}

fun payCoupon(
  bondHolder: slice,
  couponAmount: int,
  queryIdL int
){
  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(bondHolder)
    .storeCoins(couponAmount)
    .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    endCell();

  sendRawMessage(msg, 1);
}

fun redeemBond(
  bondHolder: slice,
  bondAmount: int,
  queryId: int
) {
  assert(totalLockedDom >= bondAmount, ERROR_NOT_ENOUGH_BALANCE);

  totalLockedDom -= bondAmount;
}

fun onInternalMessage(
  myBalance: int,
  msgValue: int,
  msgFull: cell,
  msgBody: slice
){
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
    var amount = msgBody.loadCoins();
    var fromAddress = msgBody.loadMsgAddress();

    totalLockedDom += amount;
    saveData();

    return;
  }

  if (op == OP_ISSUE_BOND) {
    assert(
      senderAddress.equalSlices(ownerAddress),
      ERROR_NOT_OWNER
    );

    var toAddress = msgBody.loadMsgAddress();
    var bondAmount = msgBody.loadCoins();
    var couponRate = msgBody.loadUint(16);
    var maturityDate = msgBody.loadUint(64);

    assert(
      totalLockedDom >= bondAmount,
      ERROR_NOT_ENOUGH_BALANCE
    );

    mintBondNft(
      toAddress,
      bondAmount,
    )
  }
}