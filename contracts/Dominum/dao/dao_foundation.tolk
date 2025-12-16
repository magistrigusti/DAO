import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global ownerAddress: slice;
global sharesCollectionAddress: slice;
global totalShares: int;
global totalDom: int;
global totalTon: int;
global domWalletAddress: slice;
global ethWalletAddress: slice;

global allowedDomMaster: slice;
global allowedEthMaster: slice;

fun loadData() {
  var ds = getContractData().beginParse();
  ownerAddress = ds.loadMsgAddress();
  sharesCollectionAddress = ds.loadMsgAddress();
  totalShares = ds.loadUint(64);
  totalDom = ds.loadCoins();
  totalTon = ds.loadCoins();
  domWalletAddress = ds.loadMsgAddress();

  var ref = ds.loadRef().beginParse();
  ethWalletAddress = ref.loadMsgAddress();
  allowedDomMaster = ref.loadMsgAddress();
  allowedEthMaster = ref.loadMsgAddress();
}

fun saveData() {
  setContractData(
    beginCell()
      .storeSlice(ownerAddress)
      .storeSlice(sharesCollectionAddress)
      .storeUint(totalShares, 64)
      .storeCoins(totalDom)
      .storeCoins(totalTon)
      .storeSlice(domWalletAddress)
      .storeRef(
        beginCell()
          .storeSlice(ethWalletAddress)
          .storeSlice(allowedDomMaster)
          .storeSlice(allowedEthMaster)
          .endCell()
      )
      .endCell()
  );
}

fun isAllowedJetton(masterAddress: slice): int {
  if (masterAddress.equalSlices(allowedDomMaster)) {
    return true;
  }
  if (masterAddress.equalSlices(allowedEthMaster)) {
    return true;
  }
  return false;
}

fun mintShare(
  toAddress: slice,
  shareValue: int,
  shareType: int,
  queryId: int
){
  var shareContent = beginCell()
    .storeCoins(shareValue)
    .storeUint(shareType, 8)
    .storeSlice(toAddress)
    .storeUint(now(), 64)
    .endCell();

  var msgBody = beginCell()
    .storeUint(OP_MINT_NFT, 32)
    .storeUint(queryId, 64)
    .storeUint(totalShares, 64)
    .storeCoins(MIN_TON_FOR_STORAGE)
    .storeRef(shareContent)
    .endCell();

  var msg = beginCell()
    .storeUint(0x18, 6)
    .storeSlice(sharesCollectionAddress)
    .storeCoins(MIN_TON_FOR_STORAGE * 2)
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    .storeRef(msgBody)
    .endCell();

  sendRawMessage(msg, 1);

  totalShares += 1;
}

global profinContract1: slice;
global profitContract2: slice;
global profitContract3: slice;
global profitContract4: slice;
global profitContract5: slice;

fun distributeToProfitContracts(
  amount: int,
  proportions: cell,
  queryId: int
){

}

fun onInternalMessage(
  myBalance: int,
  msgValue: int,
  msgFull: cell,
  msgBody: slice
){
  if (msgBody.isEndOfSlice()) {
    loadData();
    
  }
}