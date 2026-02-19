import { test } from 'node:test';
import {
    assertContains,
    assertNotContains,
    readContract,
} from './test-utils';

const opCodesPath =
    'contracts/Dominum/core/op_codes.tolk';

test('op_codes: есть op для one-time proxy config', () => {
    const source = readContract(opCodesPath);

    assertContains(
        source,
        'const OP_SET_PROXY_WALLET_CONFIG: int = 0xB4;',
        opCodesPath
    );
});

test('op_codes: нет deprecated rate op-кодов', () => {
    const source = readContract(opCodesPath);

    assertNotContains(
        source,
        'OP_UPDATE_POOL_RATE',
        opCodesPath
    );
    assertNotContains(
        source,
        'OP_UPDATE_RATE',
        opCodesPath
    );
});
