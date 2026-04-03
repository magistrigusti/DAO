import { toNano } from '@ton/core';
import {
    NetworkProvider,
} from '@ton/blueprint';

import {
    DEPLOY_VALUES,
    TIMELOCK_WAIT_MS,
} from '../core/config';
import { sleep } from '../core/helpers';
import {
    CompiledContracts,
    InfrastructureContracts,
    TokenGraphContracts,
} from '../core/types';

export async function configureGasPipeline(
    provider: NetworkProvider,
    compiled: CompiledContracts,
    infrastructure: InfrastructureContracts,
    graph: TokenGraphContracts
): Promise<void> {
    const ui = provider.ui();
    const sender = provider.sender();

    ui.write('--- Step 6: Configure GasProxy ---');

    await infrastructure.gasProxy.sendSetWalletConfig(
        sender,
        {
            value: toNano(DEPLOY_VALUES.proxyConfig),
            masterAddress: graph.domMaster.address,
            jettonWalletCode: compiled.walletCode,
            queryId: 1n,
        }
    );

    await provider.waitForLastTransaction();

    ui.write('GasProxy wallet config set.');

    ui.write('--- Step 7: Change GasPool with timelock ---');

    await infrastructure.gasProxy.sendRequestChangePool(
        sender,
        {
            value: toNano(DEPLOY_VALUES.poolChange),
            newGasPoolAddress: infrastructure.gasPool.address,
            queryId: 2n,
        }
    );

    await provider.waitForLastTransaction();

    ui.write(
        `Timelock started. Waiting ${TIMELOCK_WAIT_MS / 1000}s...`
    );

    await sleep(TIMELOCK_WAIT_MS);

    await infrastructure.gasProxy.sendConfirmChangePool(
        sender,
        {
            value: toNano(DEPLOY_VALUES.poolChange),
            queryId: 3n,
        }
    );

    await provider.waitForLastTransaction();

    ui.write('GasProxy now points to real GasPool.');
}