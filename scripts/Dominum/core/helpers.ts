import { beginCell, Cell } from '@ton/core';

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