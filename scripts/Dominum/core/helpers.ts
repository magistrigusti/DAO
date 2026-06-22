import {
    Address,
    beginCell,
    Cell,
    contractAddress,
} from '@ton/core';

const OFF_CHAIN_CONTENT_PREFIX = 0x01;

export function buildOffChainContent(
    url: string
): Cell {
    return beginCell()
        .storeUint(
            OFF_CHAIN_CONTENT_PREFIX,
            8
        )
        .storeStringRefTail(url)
        .endCell();
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function buildTypedPlaceholderAddress(
    namespace: number,
    targetKind: number
): Address {
    const code = beginCell()
        .storeUint(0x504c4143, 32)
        .storeUint(namespace, 16)
        .endCell();

    const data = beginCell()
        .storeUint(targetKind, 16)
        .endCell();

    return contractAddress(0, { code, data });
}
