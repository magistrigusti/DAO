import {
    compile,
    NetworkProvider,
} from '@ton/blueprint';

import { CompiledContracts } from '../core/types';

export async function compileContracts(
    provider: NetworkProvider
): Promise<CompiledContracts> {
    const ui = provider.ui();

    ui.write('Compiling contracts...');

    const compiled: CompiledContracts = {
        walletCode: await compile('DomWallet'),
        masterCode: await compile('DomMaster'),
        gasProxyCode: await compile('GasProxy'),
        gasPoolCode: await compile('GasPool'),
        giverAllodiumCode: await compile('GiverAllodium'),
        giverDefiCode: await compile('GiverDefi'),
        giverDaoCode: await compile('GiverDao'),
        giverDominumCode: await compile('GiverDominum'),
        giverManagerCode: await compile('GiverManager'),
    };

    ui.write('All contracts compiled.');

    return compiled;
}