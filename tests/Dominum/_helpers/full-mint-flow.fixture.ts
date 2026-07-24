import { Blockchain } from '@ton/sandbox';
import { Address, beginCell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { Minter } from '../../../wrappers/Dominum/treasury/Minter';
import { TreasuryPool } from '../../../wrappers/Dominum/treasury/TreasuryPool';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import { TreasuryManager } from '../../../wrappers/Dominum/management/TreasuryManager';
import { MinterManager } from '../../../wrappers/Dominum/management/MinterManager';
import { GiverManager } from '../../../wrappers/Dominum/management/GiverManager';
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';
import { GiverDao } from '../../../wrappers/Dominum/givers/GiverDao';
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';

import {
    GIVER_TARGET, TREASURY_TARGET,
} from '../../../wrappers/Dominum/core/constants';

import {
    buildTypedPlaceholderAddress,
} from '../../../scripts/Dominum/core/helpers';

import {
    DOM_COMPILE, DOM_FIXTURE, DOM_QUERY, DOM_STATE, DOM_VALUE,
} from './dom-test-values';

export const FULL_MINT_EXPECTED = {
    totalExecutions: 9n, nextRouteId: 10n, emptyBalance: 0n,
} as const;

export async function createFullMintFlowFixture() {
    const blockchain = await Blockchain.create();

    const accounts = await Promise.all([
        blockchain.treasury('deployer'),
        blockchain.treasury('master-owner'),
        blockchain.treasury('treasury-owner'),
        blockchain.treasury('treasury-manager-owner'),
        blockchain.treasury('minter-owner'),
        blockchain.treasury('minter-manager-owner'),
        blockchain.treasury('giver-manager-owner'),
        blockchain.treasury('recipient'),
    ]);

    const [
        deployer, masterOwner, treasuryOwner, treasuryManagerOwner,
        minterOwner, minterManagerOwner, giverManagerOwner, recipient,
    ] = accounts;

    const codes = await Promise.all([
        compile(DOM_COMPILE.wallet), compile(DOM_COMPILE.master),
        compile(DOM_COMPILE.minter), compile(DOM_COMPILE.treasuryPool),
        compile(DOM_COMPILE.gasPool), compile(DOM_COMPILE.treasuryManager),
        compile(DOM_COMPILE.minterManager), compile(DOM_COMPILE.giverManager),
        compile(DOM_COMPILE.giverAllodium), compile(DOM_COMPILE.giverDefi),
        compile(DOM_COMPILE.giverDao), compile(DOM_COMPILE.giverDominum),
    ]);

    const [
        walletCode, masterCode, minterCode, treasuryPoolCode, gasPoolCode,
        treasuryManagerCode, minterManagerCode, giverManagerCode,
        giverAllodiumCode, giverDefiCode, giverDaoCode, giverDominumCode,
    ] = codes;

    const gasPlaceholder =
        buildTypedPlaceholderAddress(1, TREASURY_TARGET.gasPool);

    const walletPlaceholder = buildTypedPlaceholderAddress(1, 5);
    const minterPlaceholder = buildTypedPlaceholderAddress(20, 1);

    const allodiumPlaceholder =
        buildTypedPlaceholderAddress(21, GIVER_TARGET.allodium);

    const defiPlaceholder =
        buildTypedPlaceholderAddress(21, GIVER_TARGET.defi);

    const daoPlaceholder =
        buildTypedPlaceholderAddress(21, GIVER_TARGET.dao);

    const dominumPlaceholder =
        buildTypedPlaceholderAddress(21, GIVER_TARGET.dominum);

    const treasuryManager = blockchain.openContract(
        TreasuryManager.createFromConfig(
            { ownerAddress: treasuryManagerOwner.address }, treasuryManagerCode
        )
    );

    const treasuryPool = blockchain.openContract(
        TreasuryPool.createFromConfig(
            {
                ownerAddress: treasuryOwner.address,
                treasuryManagerAddress: treasuryManager.address,
                jettonWalletAddress: walletPlaceholder, walletConfigured: false,
                bankDaoAddress: recipient.address, bankDefiAddress: recipient.address,
                bankDominumAddress: recipient.address, gasPoolAddress: gasPlaceholder,
            },
            treasuryPoolCode
        )
    );

    const gasPool = blockchain.openContract(
        GasPool.createFromConfig(
            {
                treasuryPoolAddress: treasuryPool.address,
                masterAddress: buildTypedPlaceholderAddress(2, 1),
                jettonWalletCode: walletCode, masterConfigured: false,
            },
            gasPoolCode
        )
    );

    const minterManager = blockchain.openContract(
        MinterManager.createFromConfig(
            { ownerAddress: minterManagerOwner.address }, minterManagerCode
        )
    );

    const giverManager = blockchain.openContract(
        GiverManager.createFromConfig(
            { ownerAddress: giverManagerOwner.address }, giverManagerCode
        )
    );

    const domMaster = blockchain.openContract(
        DomMaster.createFromConfig(
            {
                totalSupply: DOM_STATE.emptySupply, ownerAddress: masterOwner.address,
                lastMintTime: DOM_STATE.noLastMintTime, isStarted: false,
                treasuryPoolAddress: treasuryPool.address,
                minterAddress: minterPlaceholder,
                minterManagerAddress: minterManager.address,
                giverManagerAddress: giverManager.address,
                giverAllodiumAddress: allodiumPlaceholder,
                giverDefiAddress: defiPlaceholder, giverDaoAddress: daoPlaceholder,
                giverDominumAddress: dominumPlaceholder,
                content: beginCell().endCell(), jettonWalletCode: walletCode,
            },
            masterCode
        )
    );

    const minter = blockchain.openContract(
        Minter.createFromConfig(
            { ownerAddress: minterOwner.address, masterAddress: domMaster.address },
            minterCode
        )
    );

    const giverAllodium = blockchain.openContract(
        GiverAllodium.createFromConfig(
            {
                masterAddress: domMaster.address,
                treasuryPoolAddress: treasuryPool.address,
                jettonWalletCode: walletCode, frsAllodiumAddress: recipient.address,
                allodiumFoundationAddress: recipient.address,
            },
            giverAllodiumCode
        )
    );

    const giverDefi = blockchain.openContract(
        GiverDefi.createFromConfig(
            {
                masterAddress: domMaster.address,
                treasuryPoolAddress: treasuryPool.address,
                jettonWalletCode: walletCode, marketAddress: recipient.address,
                foundryAddress: recipient.address, defiTreasuryAddress: recipient.address,
            },
            giverDefiCode
        )
    );

    const giverDao = blockchain.openContract(
        GiverDao.createFromConfig(
            {
                masterAddress: domMaster.address,
                treasuryPoolAddress: treasuryPool.address,
                jettonWalletCode: walletCode, bankDaoAddress: recipient.address,
                daoFoundationAddress: recipient.address,
            },
            giverDaoCode
        )
    );

    const giverDominum = blockchain.openContract(
        GiverDominum.createFromConfig(
            {
                masterAddress: domMaster.address,
                treasuryPoolAddress: treasuryPool.address,
                jettonWalletCode: walletCode, bankDominumAddress: recipient.address,
                dominumFoundationAddress: recipient.address,
            },
            giverDominumCode
        )
    );

    await treasuryManager.sendDeploy(deployer.getSender(), DOM_VALUE.deploySmall);
    await treasuryPool.sendDeploy(deployer.getSender(), DOM_VALUE.deployTreasuryPool);
    await gasPool.sendDeploy(deployer.getSender(), DOM_VALUE.deployGasPool);
    await minterManager.sendDeploy(deployer.getSender(), DOM_VALUE.deploySmall);
    await giverManager.sendDeploy(deployer.getSender(), DOM_VALUE.deploySmall);
    await domMaster.sendDeploy(deployer.getSender(), DOM_VALUE.deploySmall);
    await minter.sendDeploy(deployer.getSender(), DOM_VALUE.deploySmall);
    await giverAllodium.sendDeploy(deployer.getSender(), DOM_VALUE.deployTreasuryPool);
    await giverDefi.sendDeploy(deployer.getSender(), DOM_VALUE.deployTreasuryPool);
    await giverDao.sendDeploy(deployer.getSender(), DOM_VALUE.deployTreasuryPool);
    await giverDominum.sendDeploy(deployer.getSender(), DOM_VALUE.deployTreasuryPool);

    await treasuryManager.sendReplaceTreasuryAddress(
        treasuryManagerOwner.getSender(),
        {
            value: DOM_VALUE.config, treasuryPoolAddress: treasuryPool.address,
            targetKind: TREASURY_TARGET.gasPool, oldAddress: gasPlaceholder,
            newAddress: gasPool.address, queryId: DOM_QUERY.treasuryAddressRequest,
        }
    );

    await treasuryPool.sendConfirmRequest(
        treasuryOwner.getSender(),
        { value: DOM_VALUE.config, queryId: DOM_QUERY.treasuryAddressConfirm }
    );

    await treasuryPool.sendInitMasterConfig(
        treasuryOwner.getSender(),
        {
            value: DOM_VALUE.gasPipeline, masterAddress: domMaster.address,
            jettonWalletCode: walletCode, queryId: DOM_QUERY.gasInitMaster,
        }
    );

    const treasuryWalletAddress =
        await domMaster.getWalletAddress(treasuryPool.address);

    await treasuryPool.sendInitTreasuryWalletConfig(
        treasuryOwner.getSender(),
        {
            value: DOM_VALUE.config, jettonWalletAddress: treasuryWalletAddress,
            queryId: DOM_QUERY.treasuryWalletInit,
        }
    );

    await minterManager.sendReplaceMinter(
        minterManagerOwner.getSender(),
        {
            value: DOM_VALUE.config, masterAddress: domMaster.address,
            oldMinterAddress: minterPlaceholder, newMinterAddress: minter.address,
            queryId: DOM_QUERY.replaceMinter,
        }
    );

    await domMaster.sendConfirmMasterRequest(
        masterOwner.getSender(),
        { value: DOM_VALUE.config, queryId: DOM_QUERY.replaceMinter + 1n }
    );

    async function replaceGiver(
        targetKind: number, oldAddress: Address,
        newAddress: Address, queryId: bigint
    ): Promise<void> {
        await giverManager.sendReplaceGiver(
            giverManagerOwner.getSender(),
            {
                value: DOM_VALUE.config, masterAddress: domMaster.address,
                targetKind, oldGiverAddress: oldAddress,
                newGiverAddress: newAddress, queryId,
            }
        );

        await domMaster.sendConfirmMasterRequest(
            masterOwner.getSender(),
            { value: DOM_VALUE.config, queryId: queryId + 100n }
        );
    }

    await replaceGiver(
        GIVER_TARGET.allodium, allodiumPlaceholder,
        giverAllodium.address, DOM_QUERY.replaceGiverAllodium
    );

    await replaceGiver(
        GIVER_TARGET.defi, defiPlaceholder,
        giverDefi.address, DOM_QUERY.replaceGiverDefi
    );

    await replaceGiver(
        GIVER_TARGET.dao, daoPlaceholder,
        giverDao.address, DOM_QUERY.replaceGiverDao
    );

    await replaceGiver(
        GIVER_TARGET.dominum, dominumPlaceholder,
        giverDominum.address, DOM_QUERY.replaceGiverDominum
    );

    return {
        blockchain, minterOwner, recipient, domMaster, minter,
        treasuryPool, gasPool, giverAllodium, giverDefi,
        giverDao, giverDominum,
    };
}

export type FullMintFlowFixture =
    Awaited<ReturnType<typeof createFullMintFlowFixture>>;

async function openOwnerWallet(
    fixture: FullMintFlowFixture, ownerAddress: Address
) {
    const walletAddress =
        await fixture.domMaster.getWalletAddress(ownerAddress);

    return fixture.blockchain.openContract(
        DomWallet.createFromAddress(walletAddress)
    );
}

export async function readFullMintResult(fixture: FullMintFlowFixture) {
    const recipientWallet = await openOwnerWallet(fixture, fixture.recipient.address);
    const poolWalletAddress = await fixture.gasPool.getPoolWalletAddress();

    const poolWallet = fixture.blockchain.openContract(
        DomWallet.createFromAddress(poolWalletAddress)
    );

    const giverWallets = await Promise.all([
        openOwnerWallet(fixture, fixture.giverAllodium.address),
        openOwnerWallet(fixture, fixture.giverDefi.address),
        openOwnerWallet(fixture, fixture.giverDao.address),
        openOwnerWallet(fixture, fixture.giverDominum.address),
    ]);

    const [jetton, master, gas, treasury, recipientData, poolData] =
        await Promise.all([
            fixture.domMaster.getJettonData(), fixture.domMaster.getMasterData(),
            fixture.gasPool.getGasPoolData(), fixture.treasuryPool.getTreasuryPoolData(),
            recipientWallet.getWalletData(), poolWallet.getWalletData(),
        ]);

    const giverBalances = await Promise.all(
        giverWallets.map(async (wallet) => (await wallet.getWalletData()).balance)
    );

    const givers = await fixture.domMaster.getGiversData();

    const rolesConfigured =
        master.minterAddress.equals(fixture.minter.address) &&
        givers.giverAllodiumAddress.equals(fixture.giverAllodium.address) &&
        givers.giverDefiAddress.equals(fixture.giverDefi.address) &&
        givers.giverDaoAddress.equals(fixture.giverDao.address) &&
        givers.giverDominumAddress.equals(fixture.giverDominum.address);

    return {
        totalSupply: jetton.totalSupply, masterStarted: master.isStarted,
        rolesConfigured, recipientBalance: recipientData.balance,
        poolFeeBalance: poolData.balance, gasConfigured: gas.masterConfigured,
        totalReceivedDom: gas.totalReceivedDom, totalExecuted: gas.totalExecuted,
        treasuryConfigured: treasury.walletConfigured,
        nextRouteId: treasury.nextRouteId, giverBalances,
    };
}

export async function executeFullMint(fixture: FullMintFlowFixture): Promise<void> {
    await fixture.minter.sendMint(
        fixture.minterOwner.getSender(),
        {
            value: DOM_VALUE.mint, amount: DOM_FIXTURE.firstMintAmount,
            queryId: DOM_QUERY.e2eMint,
        }
    );
}