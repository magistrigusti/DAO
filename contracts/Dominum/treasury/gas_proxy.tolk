import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// GAS PROXY — Прокси для Gas Pool
// =====================================================
// Вечный контракт. Wallet ссылается на него навсегда.
// Пересылает сообщения на реальный Gas Pool.
// Админ может менять realGasPoolAddress через timelock.
//
// Timelock: 48 часов между запросом и подтверждением.
// За это время можно заметить взлом и отменить.
// =====================================================

// Timelock: 48 часов (в секундах)
const TIMELOCK_PERIOD: int = 172800;

global adminAddress: slice;
global realGasPoolAddress: slice;

global pendingAddress: slice;
global pendingTime: int;
global hasPending: int;

fun loadData() {
  var ds = getContractData().beginParse();

  adminAddress = ds.loadMsgAddress();
  realGasPoolAddress = ds.loadMsgAddress();
  hasPending = ds.loadBool();

  if (hasPending) {
    pendingAddress = ds.loadMsgAddress();
    pendingTime = ds.loadUint(64);
  }
}

fun saveData() {
  var b = beginCell()
    .storeSlice(adminAddress)
    .storeSlice(realGasPoolAddress)
    .storeBool(hasPending);

  if (hasPending) {
    b = b.storeSlice(pendingAddress)
      .storeUint(pendingTime, 64);
  }

  setContractData(b.endCell());
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

  if (op == OP_GAS_POOL_EXECUTE) {
    var fullBody = beginCell()
      .storeUint(OP_GAS_POOL_EXECUTE, 32)
      .storeSlice(msgBody)
      .endCell();

    var msg = beginCell()
      .storeUint(0x18, 6)
      .storeSlice(realGasPoolAddress)
      .storeCoins(0)
      .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
      .storeRef(fullBody)
      .endCell();

    sendRawMessage(msg, 64);

    return;
  }

  var queryId = msgBody.loadUint(64);

  if (op == OP_REQUEST_CHANGE_POOL) {
    assert(
      senderAddress.equalSlices(adminAddress),
      ERROR_NOT_ADMIN
    );

    pendingAddress = msgBody.loadMsgAddress();
    pendingTime = now() + TIMELOCK_PERIOD;
    hasPending = true;
    saveData();

    return;
  }

  if (op == OP_CONFIRM_CHANGE_POOL) {
    assert(
      senderAddress.equalSlices(adminAddress),
      ERROR_NOT_ADMIN
    );

    assert(hasPending, ERROR_NO_PENDING);
    assert(now() => )
  }
}