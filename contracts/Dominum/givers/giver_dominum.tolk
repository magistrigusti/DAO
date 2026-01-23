import "../core/op_codes";
import "../core/errors";
import "../core/constants";

const FEE_MAGIC: int = 0xDA0FEE01;

global managerAddress: slice;
global walletAddress: slice;
global bankDominumAddress: slice;
global dominumFoundationAddress: slice;

fun loadData() {
  var ds = getContractData().beginParse();
  managerAddress = ds.loadMsgAddress();
  walletAddress = ds.loadMsgAddress();
  bankDominumAddress = ds.loadMsgAddress();
  dominumFoundationAddress = ds.loadMsgAddress();
}




// dominumFoundationAddress