import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

const FEE_MAGIC: int = 0xDA0FEE01;

global balance: int;

global ownerAddress: slice;
global masterAddress: slice;

global domTreasuryAddress: slice;
global daoTreasuryAddress: slice;
global gasPoolAddress: slice;

global jettonWalletCode: cell;

fun loadData() {
  var ds = getContractData().beginParse();

  balance = ds.loadCoins();

  ownerAddress = ds.loadMsgAddress();
  masterAddress = ds.loadMsgAddress();

  domTreasuryAddress = ds.loadMsgAddress();
  daoTreasuryAddress = ds.loadMsgAddress();
  gasPoolAddress = ds.loadMsgAddress();

  jettonWalletCode = ds.loadRef();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeCoins(balance)
      .storeSlice(ownerAddress)
      .storeSlice(masterAddress)
      .storeSlice(domTreasuryAddress)
      .storeSlice(daoTreasuryAddress)
      .storeSlice(gasPoolAddress)
      .storeRef(jettonWalletCode)
      .endCell()
  );
}

fun buildWalletData(owner: slice): cell {
  return beginCell()
    .storeCoins(0)
    .storeSlice(owner)
    .storeSlice(masterAddress)
    .storeSlice(domTreasuryAddress)
    .storeSlice(daoTreasuryAddress)
    .storeSlice(gasPoolAddress)
    .storeRef(jettonWalletCode)
    .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
  var walletData = buildWalletData(owner);

  return beginCell()
    .storeUint(0, 2)
    .storeMaybeRef(jettonWalletCode)
    .storeMaybeRef(walletData)
    .storeUint(0, 1)
    .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
  return beginCell()
    .storeUint(4, 3)
    .storeInt(0, 8)
    .storeUint(stateInit.hash(), 256)
    .endCell()
    .beginParse();
}

fun sendInternalTransfer(
  toOwner: slice,
  jettonAmount: int,
  fromOwner: slice,
  responseDestination: slice,
  queryId: int,
  msgValue: int
) {
  if (jettonAmount <= 0) {
    retunr;
  }

  var stateInit = buildWalletStateInit(toOwner);
  var toWallet = buildWalletAddress(stateInit);

  var body = beginCell()
    .storeUint(OP_INTERNAL_TRANSFER, 32)
    .storeUint(queyId, 64)
    .storeCoins(jettonAmount)
    .storeSlice(fromOwner)
    .storeSlice(responseDestination)
    .storeCoins(0)
    .storeBool(false)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(toWallet)
    .storeCoins(msgValue)
    .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
    .storeRef(stateInit)
    .storeRef(body)
    .enCell();

  sendRawMessage(msg, 1);
}

fun notifyOwner(amount: int, fromOwner: slice, queryId: int) {
  var body = beginCell()
    .storeUint(OP_TRANSFER_NOTIFICATION, 32)
    .storeUint(queryId, 64)
    .storeCoins(amount)
    .storeSlice(fromOwner)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(ownerAddress)
    .storeCoins(0)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(body)
    .endCell();

  sendRawMessage(msg, 64);
}

