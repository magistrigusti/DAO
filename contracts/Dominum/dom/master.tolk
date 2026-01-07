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
global giverEcosystemAddress: slice;

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

  var giver = ds.loadRef().beginParse();

  giverAllodiumAddress = givers.loadMsgAddress();
  giverInvestAddress = givers.loadMsgAddress();
  giverDaoAddress = givers.loadMsgAddress();
  giverDominumAddress = giver.loadMsgAddress();

  content = ds.loadRef();
  jettonWalletCode = ds.loadRef();
}

fun saveData() {
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
      .storeRef(givers)
      .storeRef(content)
      .storeRef(jettonWalletCode)
      .endCell()
  );
}

fun calculateWalletStateInit(owner: slice): cell {
  var walletData = beginCell()
    .storeCoins(0)
    .storeSlice(owner)
    .storeSlice(myAddress())
    .storeSlice(domTreasuryAddress)
    .storeSlice(daoTreasuryAddress)
    .storeSlice(gasPoolAddress)
    .endCell();

  return beginCell()
    .storeUint(0, 2);
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
  toAddress: slice,
  jettonAmount: int,
  queryId: int,
  msgValue: int
) {
  var stateInit = calculateWalletStateInit(toAddress);
  var walletAddress = calculateWalletAddress(stateInit);

  var msgBody = beginCell()
    .sotreUint(OP_INTERNAL_TRANSFER, 32)
    .storeUint(queryId, 64)
    .storeCoins(jettonAmount)
    .storeSlice(myAddress())
    .storeSlice(toAddress)
    .storeCoins(0)
    .storeBool(false)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(walletAddress)
    .storeCoins(msgValue)
    .storeUint(
      4 + 2 + 1,
            1 + 4 + 4 + 64 + 32 + 1 + 1 + 1
    )
    .storeRef(stateInit)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);
};

fun mintJettons(amount: int, queryId: int, msgValue: int) {
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
  var tonRemainder = masValue - tonPer * 4;

  sendToWallet(
    giverAllodiumAddress,
    amountAllodium,
    queryId,
     tonPer + tonRemainder
  );

  sendRoWallet(
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

  sendToWallet(
    giverDominumAddress,
    amountDominum,
    queryId + 3,
    tonPer
  );

  saveData();

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

  if (flag & 1) {
    return;
  }

  var senderAddress = cs.loadMsgAddress();
  loadData();
}





Dominum это за место Ecosystem