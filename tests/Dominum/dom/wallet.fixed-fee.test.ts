import { test } from 'node:test';
import {
    assertContains,
    assertNotContains,
    readContract,
} from '../core/test-utils';

const walletPath =
    'contracts/Dominum/dom/wallet.tolk';

test('wallet: фиксированные комиссии без custom payload', () => {
    const source = readContract(walletPath);

    assertContains(
        source,
        'var treasuryFee: int = TAX_AMOUNT;',
        walletPath
    );
    assertContains(
        source,
        'var gasPoolFee: int = TAX_HALF;',
        walletPath
    );
    assertContains(
        source,
        '.storeCoins(treasuryFee)',
        walletPath
    );
    assertContains(
        source,
        '.storeCoins(gasPoolFee)',
        walletPath
    );

    assertNotContains(source, 'FEE_MAGIC', walletPath);
    assertNotContains(source, 'hasCustom', walletPath);
    assertNotContains(
        source,
        'newTreasuryFee',
        walletPath
    );
    assertNotContains(source, 'newGasFee', walletPath);
});
