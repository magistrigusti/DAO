// =====================================================
// MASTER ALLOD — Jetton Master с FRS allowance
// =====================================================
// 1) FRS увеличивает mintAllowancePool
// 2) Owner минтит ALLOD только в рамках allowance
// 3) Burn из wallet уменьшает supply и шлет OP_ALLOD_BURNED в FRS
// =====================================================

import "../core/op_codes";
import "../core/errors";
import "../core/constants";

global totalSupply: int;

global ownerAddress: slice;
global frsAddress: slice;
global foundationAddress: slice;

global mintAllowancePool: int;

global content: cell;
global jettonWalletCode: cell;

fun loadData() {
  var ds = getContractData().beginParse();

  totalSupply = ds.loadCoins();

  ownerAddress = ds.loadMsgAddress();
  frsAddress = ds.loadMsgAddress();
  foundationAddress = ds.loadMsgAddress();

  mintAllowancePool = ds.loadCoins();

  content = ds.loadRef();
  jettonWalletCode = ds.loadRef();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeCoins(totalSupply)
      .storeSlice(ownerAddress)
      .storeSlice(frsAddress)
      .storeSlice(foundationAddress)
      .storeCoins(mintAllowancePool)
      .storeRef(content)
      .storeRef(jettonWalletCode)
      .endCell()
  );
}

fun calculateWalletData(owner: slice): cell {
  return beginCell()
    .storeCoins(0)
    .storeSlice(owner)
    .storeSlice(myAddress())
    .storeSlice(foundationAddress)
    .storeRef(jettonWalletCode)
    .endCell();
}

fun calculateWalletStateInit(owner: slice): cell {
  var walletData = calculateWalletData(owner);

  return beginCell()
    .storeUint(0, 2)
    .storeMaybeRef(jettonWalletCode)
    .storeMaybeRef(walletData)
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
  toOwner: slice,
  jettonAmount: int,
  queryId: int,
  msgValue: int
) {
  var stateInit = calculateWalletStateInit(toOwner);
  var walletAddress = calculateWalletAddress(stateInit);

  var body = beginCell()
    .storeUint(OP_INTERNAL_TRANSFER, 32)
    .storeUint(queryId, 64)
    .storeCoins(jettonAmount)
    .storeSlice(myAddress())
    .storeSlice(toOwner)
    .storeCoins(0)
    .storeBool(false)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(walletAddress)
    .storeCoins(msgValue)
    .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
    .storeRef(stateInit)
    .storeRef(body)
    .endCell();

  sendRawMessage(msg, 1);
}

fun sendAllodBurnedToFrs(burnAmount: int, queryId: int) {
  var body = beginCell()
    .storeUint(OP_ALLOD_BURNED, 32)
    .storeUint(queryId, 64)
    .storeCoins(burnAmount)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(frsAddress)
    .storeCoins(0)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(body)
    .endCell();

  sendRawMessage(msg, 64);
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

  var senderAddress = cs.loadMsgAddress();

  loadData();

  var op = msgBody.loadUint(32);
  var queryId = msgBody.loadUint(64);

  if (op == OP_INCREASE_MINT_ALLOWANCE) {
    assert(
      senderAddress.equalSlices(frsAddress),
      ERROR_NOT_FRS
    );

    var allowanceAmount = msgBody.loadCoins();
    assert(allowanceAmount > 0, ERROR_INVALID_AMOUNT);

    mintAllowancePool = mintAllowancePool + allowanceAmount;

    saveData();
    return;
  }

  if (op == OP_MINT) {
    assert(
      senderAddress.equalSlices(ownerAddress),
      ERROR_NOT_OWNER
    );

    var toOwner = msgBody.loadMsgAddress();
    var mintAmount = msgBody.loadCoins();

    assert(mintAmount > 0, ERROR_INVALID_AMOUNT);
    assert(
      mintAmount <= mintAllowancePool,
      Error_LIMIT_EXCEEDED
    );
    assert(
      msgValue >= MIN_TON_FOR_STOARAGE,
      ERROR_INSUFFICIENT_GAS
    );

    mintAllowancepool = mintAllowancePool - mintAmount;
    totalSupply - totalSupply + minAmount;
    saveData();

    sendToWallet(
      toOwner,
      mintAmount,
      queryId,
      msgValue
    );

    return;
  }
}