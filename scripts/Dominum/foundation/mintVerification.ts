import { OpenedContract } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import { FIRST_MINT_CONFIG } from '../core/config';
import { sleep } from '../core/helpers';

import {
    InfrastructureContracts, TokenGraphContracts,
} from '../core/types';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { ExpectedMintWallet } from './mintDistribution';

type WalletExpectation = {
    expectedAmount: bigint; wallet: OpenedContract<DomWallet>;
};

async function readWalletBalance(
    wallet: OpenedContract<DomWallet>
): Promise<bigint> {
    return (await wallet.getWalletData()).balance;
}

async function openExpectedWallets(
    provider: NetworkProvider, graph: TokenGraphContracts,
    expected: ExpectedMintWallet[]
): Promise<WalletExpectation[]> {
    return Promise.all(
        expected.map(async (entry) => {
            const walletAddress =
                await graph.domMaster.getWalletAddress(entry.owner);

            return {
                expectedAmount: entry.amount,
                wallet: provider.open(DomWallet.createFromAddress(walletAddress)),
            };
        })
    );
}

async function waitForDistribution(
    provider: NetworkProvider, infrastructure: InfrastructureContracts,
    graph: TokenGraphContracts, expected: ExpectedMintWallet[]
): Promise<void> {
    const config = FIRST_MINT_CONFIG;
    const wallets = await openExpectedWallets(provider, graph, expected);
    const expectedFee = config.giverFeeDom * config.totalTransferCount;
    let lastError: unknown;

    for (
        let attempt = config.pollAttemptStart;
        attempt <= config.pollAttemptCount;
        attempt += config.pollAttemptStep
    ) {
        try {
            const [jetton, gas, treasury] = await Promise.all([
                graph.domMaster.getJettonData(),
                infrastructure.gasPool.getGasPoolData(),
                infrastructure.treasuryPool.getTreasuryPoolData(),
            ]);

            const balances = await Promise.all(
                wallets.map((item) => readWalletBalance(item.wallet))
            );

            const recipientsReady = balances.every(
                (balance, index) => balance === wallets[index].expectedAmount
            );

            const protocolReady =
                jetton.totalSupply === config.amount &&
                gas.totalExecuted === config.totalTransferCount &&
                gas.totalReceivedDom === expectedFee &&
                treasury.nextRouteId === config.finalRouteId;

            if (protocolReady && recipientsReady) {
                return;
            }
        } catch (error) {
            lastError = error;
        }

        provider.ui().write(
            `Waiting for DOM distribution ${attempt}/${config.pollAttemptCount}`
        );

        await sleep(config.pollDelayMs);
    }

    if (lastError instanceof Error) {
        throw new Error(`Mint confirmation timeout: ${lastError.message}`);
    }

    throw new Error('Mint confirmation timeout without getter error');
}

async function assertGiverWalletsEmpty(
    provider: NetworkProvider, graph: TokenGraphContracts
): Promise<void> {
    const giverAddresses = [
        graph.giverAllodium.address, graph.giverDefi.address,
        graph.giverDao.address, graph.giverDominum.address,
    ];

    for (const giverAddress of giverAddresses) {
        const walletAddress =
            await graph.domMaster.getWalletAddress(giverAddress);

        const wallet =
            provider.open(DomWallet.createFromAddress(walletAddress));

        const balance = await readWalletBalance(wallet);

        if (balance !== FIRST_MINT_CONFIG.emptyAmount) {
            throw new Error('A Giver wallet kept undistributed DOM');
        }
    }
}

export async function verifyFirstMintDistribution(
    provider: NetworkProvider, infrastructure: InfrastructureContracts,
    graph: TokenGraphContracts, expected: ExpectedMintWallet[]
): Promise<void> {
    await waitForDistribution(provider, infrastructure, graph, expected);
    await assertGiverWalletsEmpty(provider, graph);
}