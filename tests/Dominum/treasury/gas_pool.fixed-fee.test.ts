import { test } from 'node:test';
import {
    assertContains,
    readContract,
} from '../core/test-utils';

const poolPath =
    'contracts/Dominum/treasury/gas_pool.tolk';

test('gas_pool: принимает только фиксированные комиссии', () => {
    const source = readContract(poolPath);

    assertContains(
        source,
        'assert(treasuryFee == TAX_AMOUNT, ERROR_INVALID_AMOUNT);',
        poolPath
    );
    assertContains(
        source,
        'assert(gasPoolFee == TAX_HALF, ERROR_INVALID_AMOUNT);',
        poolPath
    );
});
