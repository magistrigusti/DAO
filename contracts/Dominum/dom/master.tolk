import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global totalSupply: int;

global adminAddress: slice;
global minterAddress: slice;
global managerAddress: slice;

global domTreasuryAddress: slice;
global daoTreasuryAddress: slice;
global gasPoolAddress: slice;

global giverAllodiumAddress: slice;
global giverInvestAddress: slice;
global giverDaoAddress: slice;
global giverDominumAddress: slice;

global content: cell;
global jettonWalletCode: cell;

fun loadData() {
  var ds = getContractData().beginParse();

  totalSupply = ds.loadCoins();

  adminAddress = ds.loadMsgAddress();
  minterAddress = ds.loadMsgAddress();
  managerAddress = ds.loadMsgAddress();

  domTreasuryAddress = ds.loadMsgAddress();
  daoTreasuryAddress = ds.loadMsgAddress();
  gasPoolAddress = ds.loadMsgAddress();

  var givers = ds.loadRef().beginParse();

  giverAllodiumAddress = givers.loadmsgAddress();
  giverInvestAddress = giver.loadMsgAddress();
  giverDaoAddress = giver.loadMsgAddress();
  giverDominumAddress = giver.loadMsgAddress();

  content = ds.loadRef();
  jettonWalletCode = ds.loadRef();
}

fun saveDate() {
  var givers = beginCell()
    .storeSlice(giverAllodiumAddress)
    .storeSlice(giverInvestAddress)
    .storeSlice(giverDaoAddress)
    .storeSlice(giverDominumAddress)
    .endCell();

  setContractData(
    beginCell()
      .storeCoins(totalSupply)
      .storeSlice(adminAddress)
      .storeSlice(minterAddress)
      .storeSlice(managerAddress)
      .storeSlice(domTreasuryAddress)
      .storeSlice(daoTreasuryAddress)
      .storeSlice(gasPoolAddress)
      .storeSlice(givers)
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
    .storeSlice(domTreasuryAddress)
    .storeSlice(daoTreasuryAddress)
    .storeSlice(gasPoolAddress)
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
    .storeUint(4,3)
    .storeInt(0, 8)
    .storeUint(stateInit.has(), 256)
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

  var msgBody = beginCell()
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
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);
}

fun mintJettons(amout: int, queryId: int, queryId: int, msgValue: int){
  assert(
    totalSupply + amount <= MAX_SUPPLY,
    ERROR_LIMIT_EXCEEDED
  );

  totalSupply = totalSupply + amount;

  var amountAllodium = amount * 30 / 100;
  var amountInvest = amount * 20 / 100;
  var amountDao = amount * 25 / 100;

  var amountDominum = amount
    - amountAllodium
    - amountInvest
    - amountDao;

  var tonPer = msgValue / 4;
  var tonRemainder = msgValue - tonPer * 4;

  sendToWallet(
    giverAllodiumAddress,
    amountAllodium,
    queryId,
    tonPer + tonRemainder
  );

  sendToWallet(
    giverInvestAddress,
    amountInvest,
    queryId + 1,
    tonPer
  );

  sendToWallet(
    giverDaoAddress,
    amountDao,
    queryId + 2,
    tonPer
  );

  saveData();
}

fun onInternalMessage(
  myBalance: int,
  msgValue: int,
  msgFull; cell,
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
    assert(
      senderAddress.equalSlices(minterAddress),
      ERROR_NOT_MINTER
    );

    var amount = msgBody.loadCoins();
    assert(amount > 0, ERROR_INVALID_AMOUNT);

    mintJettons(amount, queryId, msgValue);
    return;
  }

  if (op == OP_BURN_NOTIFICATION) {
    var burnAmount = msgBody.loadCoins();
    var fromOwner = msgBody.loadMsgAddress();

    var expectedWallet = calculateWalletAddress(
      calculateWalletStateInit(fromOwner)
    );

    assert(
      senderAddress.equalSlices(expectedWallet),
      ERROR_NOT_VALID_WALLET
    );

    totalSupply = totalSupply - burnAmount;
    saveData();

    var responseAddress = msgBody.loadMsgAddress();

    if (~responseAddress.isAddressNone()) {
      var msg = beginCell()
        .storeUint(ox10, 6)
        .storeSlice(responseAddress)
        .storeCoins(0)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeUint(OP_EXCESSES, 32)
        .storeUint(queryId, 64)
        .endCell();

      sendRawMessage(msg, 64 + 2);
    }

    return;
  }

  if (op == OP_REPLACE_MANAGER) {
    assert(
      senderAddress.equalSlices(adminAddress),
      ERROR_NOT_ADMIN
    );

    var newManager = msgBody.loadMsgAddress();
    managerAddress = newManager;
    saveData();

    return;
  }

  if (op == OP_CHANGE_MASTER_ADMIN) {
    assert(
      senderAddress.equalSlices(adminAddress),
      ERROR_NOT_ADMIN
    );

    var newAdmin = msgBody.loadMsgAddress();
    adminAddress = newAdmin;
    saveData();

    return;
  }

  throw(0xffff);
}

get fun getJettonData(): (int, int, slice, cell, cell) {
  loadData();

  return (
    totalSupply,
    -1,
    adminAddress,
    content,
    jettonWalletCode
  );
}

get fun getWalletAddress(ownerAddress: slice): slice {
  loadData();
}