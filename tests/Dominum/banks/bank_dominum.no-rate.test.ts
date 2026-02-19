import { test } from 'node:test';
import {
    assertNotContains,
    readContract,
} from '../core/test-utils';

const bankPath =
    'contracts/Dominum/banks/bank_dominum.tolk';

test('bank_dominum: ветка обновления rate удалена', () => {
    const source = readContract(bankPath);

    assertNotContains(
        source,
        'OP_UPDATE_POOL_RATE',
        bankPath
    );
    assertNotContains(
        source,
        'OP_UPDATE_RATE',
        bankPath
    );
});
