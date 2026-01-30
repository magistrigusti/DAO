import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

global adminAddress: slice;
global treasuryManaderAddress: slice;

global domTreasuryAddress: slice;
global daoTreasuryAddress: slice;

global masterAddress: slice;
global jettonWalletCode: cell;

global domBalance: int;
global tonReserve: int;

fun loadData() {
    var ds = getContractData().beginParse();

    adminAddress = ds.loadMsgAddress();
    treasuryManagerAddress = ds.loadMsgAddress();

    domTreasuryAddress = ds.loadMsgAddress();
    daoTreasuryAddress = ds.loadMsgAddress();

    masterAddress = ds.loadMsgAddress();
    jettonWalletCode = ds.loadRef();

    domBalance = ds.loadCoins();
    tonReserve = ds.loadCoins();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(treasuryManagerAddress)
            .storeSlice(domTreasuryAddress)
            .storeSlice(daoTreasuryAddress)
            .storeSlice(masterAddress)
            .storeRef(jettonWalletCode)
            .storeCoins(domBalance)
            .storeCoins(tonReserve)
            .endCell()
    );
}

