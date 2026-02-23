import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

global balance: int;
global ownerAddress: address;
global masterAddress: address;
global gasPoolAddress: address;
global jettonWalletCode: cell;

fun loadData() {
    var ds = contract.getData().beginParse();

    balance = ds.loadCoins();
    ownerAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    gasPoolAddress = ds.loadAddress();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeCoins(balance)
            .storeAddress(ownerAddress)
            .storeAddress(masterAddress)
            .storeAddress(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

func buildWalletData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: address): cell {
    var walletData = buildWalletData(owner);

    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(wc, stateInit.hash());
}

