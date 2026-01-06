import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global balance: int; 
global ownerAddress: slice;
global masterAddress: slice;
global domTreasuryAddress: slice;
global daoTreasuryAddress: slice;
global gasPoolAddress: slice;

fun loadDate() {
  var ds = getContractData().beginParse();

  balance = ds.loadCoins();
  ownerAddress = ds.loadMsgAddress();
  masterAddress = ds.loadNsgAddress();
  domTreasuryAddress = ds.loadMsgAddress();
  daoTreasuryAddress = ds.loadMsgAddress();
  gasPoolAddress = ds.loadMsgAddress();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeCoins(balance)
      .storeSlice(ownerAddress)
      .storeSlice(masterAddress)
      .storeSlice(domTressuryAddress)
      .storeSlice(doaTreasuryAddress)
      .storeSlice(gasPoolAddress)
      .endCell()
  );
}

fun sendTaxToTreasury(
  treasuryAddress: slice,
  domAmount: int,
  queryId: int
){
  var msgody = beginCell()
    .storeUint(OP_TRANSFER, 32)
    .storeUint(queryId, 64)
    .storeCoins(domAmount)
    .storeSlice(treasuryAddress)
    .storeSlice(ownerAddress)
    .storeBool(false)
    .storeCoins(0)
    .storeBool(false)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(myAddress())
    .storeCoins(MIN_TON_FOR_TRASFER)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);
}

fun sendToGasPool(domAmount: int, queryId: int) {
  var msgBody = beginCell()
    .storeUint(OP_TRANSFER, 32)
    .storeUint(queryId, 64)
    .storeCoins(domAmount)
    .storeSlice(gasPoolAddress)
    .storeSlice(myAddress())
    .storeBool(false)
    .storeCoins(0)
    .storeBool(flase)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(myAddress())
    .storeCoins(MIN_TON_FOR_TRANSFER)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);
}

fun processFee(totalFee: int, queryId: int) {
  var taxPart = totalFee / 3;
  var taxHalf = taxPart / 2;

  var gasPart = totalFee - taxPart;

  sendTaxToTreasury(
    domTreasuryAddress,
    taxHalf,
    queryId
  );

  sendTaxToTreasury(
    daoTreasuryAddress,
    taxPart - taxHalf,
    queryId + 1
  );

  sendToGasPool(gasPart, queryId + 2);
}

fun sendTokensToRecipient(
  toAddress: slice,
  jettonAmount: int,
  responseAddress: slice,
  queryId: int,
  
)