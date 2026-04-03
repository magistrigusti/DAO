import { toNano } from '@ton/core';
import {
    NetworkProvider,
} from '@ton/blueprint';

import { DEPLOY_VALUES } from '../core/config';
import { TokenGraphContracts } from '../core/types';

export async function configureGiverWallets(
    provider: NetworkProvider,
    graph: TokenGraphContracts
): Promise<void> {
    const ui = provider.ui();
    const sender = provider.sender();

    ui.write('--- Step 8: Configure giver wallets ---');

    const giverAllodiumWallet =
        await graph.domMaster.getWalletAddress(
            graph.giverAllodium.address
        );

    const giverDefiWallet =
        await graph.domMaster.getWalletAddress(
            graph.giverDefi.address
        );

    const giverDaoWallet =
        await graph.domMaster.getWalletAddress(
            graph.giverDao.address
        );

    const giverDominumWallet =
        await graph.domMaster.getWalletAddress(
            graph.giverDominum.address
        );

    await graph.giverManager.sendSetWallet(sender, {
        value: toNano(DEPLOY_VALUES.giver),
        giverAddress: graph.giverAllodium.address,
        walletAddress: giverAllodiumWallet,
        queryId: 11n,
    });
    await provider.waitForLastTransaction();

    await graph.giverManager.sendSetWallet(sender, {
        value: toNano(DEPLOY_VALUES.giver),
        giverAddress: graph.giverDefi.address,
        walletAddress: giverDefiWallet,
        queryId: 12n,
    });
    await provider.waitForLastTransaction();

    await graph.giverManager.sendSetWallet(sender, {
        value: toNano(DEPLOY_VALUES.giver),
        giverAddress: graph.giverDao.address,
        walletAddress: giverDaoWallet,
        queryId: 13n,
    });
    await provider.waitForLastTransaction();

    await graph.giverManager.sendSetWallet(sender, {
        value: toNano(DEPLOY_VALUES.giver),
        giverAddress: graph.giverDominum.address,
        walletAddress: giverDominumWallet,
        queryId: 14n,
    });
    await provider.waitForLastTransaction();

    ui.write('Giver wallets configured.');
}