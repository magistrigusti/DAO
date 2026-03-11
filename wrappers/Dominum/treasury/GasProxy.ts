import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
} from '@ton/core';
const OP_REQUEST_CHANGE_POOL = 0xb0;
const OP_CONFIRM_CHANGE_POOL = 0xb1;
const OP_CANCEL_CHANGE_POOL = 0xb2;
const OP_SET_PROXY_WALLET_CONFIG = 0xb4;

export type GasProxyConfig = {
    adminAddress: Address;
    realGasPoolAddress: Address;
    walletConfigReady: boolean;
    masterAAddress?: Address | null;
    jettonWalletCode?: Cell | null;
    hasPending: boolean;
    pendingAddress?: Address | null;
    pendingTime?: bigint;
};

export function gasProxyConfigToCell(
    config: GasProxyConfig
): Cell {
    let builder = beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.realGasPoolAddress)
        .storeBit(config.walletConfigReady);

    if (config.walletConfigReady) {
        if (!config.masterAddress || !config.jettonWalletCode) {
            throw new Error(
                'GasProxy: masterAddress and jettonWalletCode are required when walletConfig Ready = true'
            );
        }

        builder = builder
            .storeAddress(config.masterAddress)
            .storeRef(config.jettonWalletCode);
    }
}