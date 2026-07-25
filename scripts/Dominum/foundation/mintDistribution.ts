import { Address } from '@ton/core';

import {
    DomDistributionAddresses, FIRST_MINT_CONFIG,
} from '../core/config';

export type ExpectedMintWallet = { owner: Address; amount: bigint };

function addExpectedAmount(
    expected: Map<string, ExpectedMintWallet>, owner: Address, amount: bigint
): void {
    const key = owner.toRawString();
    const current = expected.get(key);

    if (current) {
        current.amount += amount;
        return;
    }

    expected.set(key, { owner, amount });
}

export function buildExpectedDistribution(
    distribution: DomDistributionAddresses
): ExpectedMintWallet[] {
    const config = FIRST_MINT_CONFIG;
    const expected = new Map<string, ExpectedMintWallet>();

    const allodiumGross =
        config.amount * config.allodiumShare / config.percentBase;

    const defiGross =
        config.amount * config.defiShare / config.percentBase;

    const daoGross =
        config.amount * config.daoShare / config.percentBase;

    const dominumGross =
        config.amount - allodiumGross - defiGross - daoGross;

    const allodiumNet =
        allodiumGross - config.giverFeeDom * config.allodiumTransfers;

    const allodiumFirst = allodiumNet / config.allodiumTransfers;
    const allodiumSecond = allodiumNet - allodiumFirst;

    addExpectedAmount(expected, distribution.frsAllodium, allodiumFirst);

    addExpectedAmount(
        expected, distribution.allodiumFoundation, allodiumSecond
    );

    const defiNet =
        defiGross - config.giverFeeDom * config.defiTransfers;

    const marketAmount =
        defiNet * config.defiMarketShare / config.percentBase;

    const foundryAmount =
        defiNet * config.defiFoundryShare / config.percentBase;

    const defiTreasuryAmount = defiNet - marketAmount - foundryAmount;

    addExpectedAmount(expected, distribution.defiMarket, marketAmount);
    addExpectedAmount(expected, distribution.defiFoundry, foundryAmount);

    addExpectedAmount(
        expected, distribution.defiTreasury, defiTreasuryAmount
    );

    const daoNet =
        daoGross - config.giverFeeDom * config.daoTransfers;

    const daoBankAmount = daoNet / config.daoTransfers;
    const daoFoundationAmount = daoNet - daoBankAmount;

    addExpectedAmount(expected, distribution.daoBank, daoBankAmount);

    addExpectedAmount(
        expected, distribution.daoFoundation, daoFoundationAmount
    );

    const dominumNet =
        dominumGross - config.giverFeeDom * config.dominumTransfers;

    const dominumBankAmount = dominumNet / config.dominumTransfers;
    const dominumFoundationAmount = dominumNet - dominumBankAmount;

    addExpectedAmount(expected, distribution.dominumBank, dominumBankAmount);

    addExpectedAmount(
        expected, distribution.dominumFoundation, dominumFoundationAmount
    );

    const wallets = Array.from(expected.values());

    const recipientTotal = wallets.reduce<bigint>(
        (total, wallet) => total + wallet.amount, config.emptyAmount
    );

    const feeTotal = config.giverFeeDom * config.totalTransferCount;

    if (recipientTotal + feeTotal !== config.amount) {
        throw new Error(
            'First mint distribution does not preserve total supply'
        );
    }

    return wallets;
}
