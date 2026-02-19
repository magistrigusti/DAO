import { test } from 'node:test';
import {
    assertContains,
    readContract,
} from '../core/test-utils';

const proxyPath =
    'contracts/Dominum/treasury/gas_proxy.tolk';

test('gas_proxy: one-time wallet config включен', () => {
    const source = readContract(proxyPath);

    assertContains(
        source,
        'if (op == OP_SET_PROXY_WALLET_CONFIG)',
        proxyPath
    );
    assertContains(
        source,
        'assert(!walletConfigReady, ERROR_ALREADY_INITIALIZED);',
        proxyPath
    );
    assertContains(
        source,
        'assert(walletConfigReady, ERROR_PROXY_NOT_CONFIGURED);',
        proxyPath
    );
});

test('gas_proxy: фиксированные проверки комиссии', () => {
    const source = readContract(proxyPath);

    assertContains(
        source,
        'assert(treasuryFee == TAX_AMOUNT, ERROR_INVALID_AMOUNT);',
        proxyPath
    );
    assertContains(
        source,
        'assert(gasPoolFee == TAX_HALF, ERROR_INVALID_AMOUNT);',
        proxyPath
    );
});
