import "wallet_storage.tolk";
import "../core/errors.tolk";

fun walletBuildData(owner: address): cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(masterAddress)
        .storeAddress(treasuryPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun walletBuildStateInit(owner: address): cell {
    var walletData = walletBuildData(owner);
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun walletBuildAddress(stateInit: cell): address {
    var wc = contract.getAddress().getWorkchain();
    return address.fromWorkchainAndHash(wc, stateInit.hash());
}

fun walletAddressForOwner(owner: address): address {
    return walletBuildAddress(walletBuildStateInit(owner));
}

fun walletRequireInternalSender(
    senderAddress: address,
    fromOwner: address
) {
    if (senderAddress == masterAddress) {
        return;
    }
    if (senderAddress == treasuryPoolAddress) {
        return;
    }
    assert(
        senderAddress == walletAddressForOwner(fromOwner),
        ERROR_NOT_VALID_WALLET
    );
}
