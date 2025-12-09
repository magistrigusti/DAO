import "op_codes.tolk"
import "errors.tolk"
import "constants.tolk"

global totalSupply: int;
global minterAddress: slice;
global treasuryAddress: slice;
global giver1Address: slice;
global giver2Address: slice;
global giver3Address: slice;
global content: cell';
global jettonWalletCode: cell;

fun loadData() {
	var ds = getContractData().beginParse();

	totalSupply = ds.loadCoins();
	minterAddress = ds.loadMsgAddress();
	treasuryAddress = ds.loadMsgAddress();

	var giversCell = ds.loadRef().beginParse();
	giver1Address = giversCell.loadMsgAddress();
}