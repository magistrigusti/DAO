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

