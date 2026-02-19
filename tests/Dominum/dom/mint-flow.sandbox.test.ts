import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '@ton/blueprint';
import { Blockchain, SandboxContract } from '@ton/sandbox';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { DomMaster } from '../../../wrappers/DomMaster';
import { DomWallet } from '../../../wrappers/DomWallet';
import { GasProxy } from '../../../wrappers/GasProxy';
import { GasPool } from '../../../wrappers/GasPool';
import { GiverManager } from '../../../wrappers/GiverManager';
import { Giver } from '../../../wrappers/Giver';

const TIMELOCK_PERIOD = 172800;
const TAX_AMOUNT = 100_000_000n;
const TAX_HALF = 50_000_000n;
const MINT_AMOUNT = 4_000_000_000n;

function emptyContent(): Cell {
    return beginCell().endCell();
}

async function getWalletBalance(
    blockchain: Blockchain,
    master: SandboxContract<DomMaster>,
    ownerAddress: Address
) {
    const walletAddress = await master.getWalletAddress(
        ownerAddress
    );
    const wallet = blockchain.openContract(
        DomWallet.createFromAddress(walletAddress)
    );
    const data = await wallet.getWalletData();

    return data.balance;
}

test('dominum e2e: mint -> givers -> recipients', async () => {
    const blockchain = await Blockchain.create();

    const walletCode = await compile('DomWallet');
    const masterCode = await compile('DomMaster');
    const gasProxyCode = await compile('GasProxy');
    const gasPoolCode = await compile('GasPool');
    const giverManagerCode = await compile('GiverManager');
    const giverAllodiumCode = await compile('GiverAllodium');
    const giverDefiCode = await compile('GiverDefi');
    const giverDaoCode = await compile('GiverDao');
    const giverDominumCode = await compile('GiverDominum');

    const proxyAdmin = await blockchain.treasury('proxyAdmin');
    const poolAdmin = await blockchain.treasury('poolAdmin');
    const managerOwner = await blockchain.treasury('managerOwner');
    const minterAdmin = await blockchain.treasury('minterAdmin');

    const domTreasuryOwner = await blockchain.treasury(
        'domTreasuryOwner'
    );
    const allodiumFrs = await blockchain.treasury('allodiumFrs');
    const allodiumFoundation = await blockchain.treasury(
        'allodiumFoundation'
    );
    const defiBank = await blockchain.treasury('defiBank');
    const defiDual = await blockchain.treasury('defiDual');
    const bankDao = await blockchain.treasury('bankDao');
    const daoFoundation = await blockchain.treasury(
        'daoFoundation'
    );
    const bankDominum = await blockchain.treasury(
        'bankDominum'
    );
    const dominumFoundation = await blockchain.treasury(
        'dominumFoundation'
    );

    // Сначала создаем proxy с пустым realGasPoolAddress.
    // После деплоя gas_pool переключим адрес через timelock.
    const gasProxy = blockchain.openContract(
        GasProxy.createFromConfig(
            {
                adminAddress: proxyAdmin.address,
                realGasPoolAddress: null,
                walletConfigReady: false,
                hasPending: false,
            },
            gasProxyCode
        )
    );

    const gasPool = blockchain.openContract(
        GasPool.createFromConfig(
            {
                adminAddress: poolAdmin.address,
                proxyAddress: gasProxy.address,
                domTreasuryAddress: domTreasuryOwner.address,
                domBalance: 0n,
                tonReserve: 0n,
                hasPendingTreasury: false,
            },
            gasPoolCode
        )
    );

    const giverManager = blockchain.openContract(
        GiverManager.createFromConfig(
            {
                ownerAddress: managerOwner.address,
            },
            giverManagerCode
        )
    );

    const giverAllodium = blockchain.openContract(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: allodiumFrs.address,
                secondTargetAddress: allodiumFoundation.address,
            },
            giverAllodiumCode
        )
    );

    const giverDefi = blockchain.openContract(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: defiBank.address,
                secondTargetAddress: defiDual.address,
            },
            giverDefiCode
        )
    );

    const giverDao = blockchain.openContract(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: bankDao.address,
                secondTargetAddress: daoFoundation.address,
            },
            giverDaoCode
        )
    );

    const giverDominum = blockchain.openContract(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: bankDominum.address,
                secondTargetAddress: dominumFoundation.address,
            },
            giverDominumCode
        )
    );

    const master = blockchain.openContract(
        DomMaster.createFromConfig(
            {
                totalSupply: 0n,
                minterAddress: minterAdmin.address,
                gasPoolAddress: gasProxy.address,
                giverAllodiumAddress: giverAllodium.address,
                giverDefiAddress: giverDefi.address,
                giverDaoAddress: giverDao.address,
                giverDominumAddress: giverDominum.address,
                content: emptyContent(),
                jettonWalletCode: walletCode,
            },
            masterCode
        )
    );

    await gasProxy.sendDeploy(
        proxyAdmin.getSender(),
        toNano('0.5')
    );
    await gasPool.sendDeploy(
        poolAdmin.getSender(),
        toNano('5')
    );

    await giverManager.sendDeploy(
        managerOwner.getSender(),
        toNano('0.3')
    );
    await giverAllodium.sendDeploy(
        managerOwner.getSender(),
        toNano('0.3')
    );
    await giverDefi.sendDeploy(
        managerOwner.getSender(),
        toNano('0.3')
    );
    await giverDao.sendDeploy(
        managerOwner.getSender(),
        toNano('0.3')
    );
    await giverDominum.sendDeploy(
        managerOwner.getSender(),
        toNano('0.3')
    );

    await master.sendDeploy(
        minterAdmin.getSender(),
        toNano('1')
    );

    // Настраиваем реальный Gas Pool через timelock.
    await gasProxy.sendRequestChangePool(
        proxyAdmin.getSender(),
        {
            value: toNano('0.05'),
            queryId: 1n,
            newPoolAddress: gasPool.address,
        }
    );

    const now = blockchain.now
        ?? Math.floor(Date.now() / 1000);
    blockchain.now = now + TIMELOCK_PERIOD + 1;

    await gasProxy.sendConfirmChangePool(
        proxyAdmin.getSender(),
        {
            value: toNano('0.05'),
            queryId: 2n,
        }
    );

    // One-time config для проверки wallet sender.
    await gasProxy.sendSetWalletConfig(
        proxyAdmin.getSender(),
        {
            value: toNano('0.05'),
            queryId: 3n,
            masterAddress: master.address,
            walletCode,
        }
    );

    const givers: SandboxContract<Giver>[] = [
        giverAllodium,
        giverDefi,
        giverDao,
        giverDominum,
    ];

    for (let i = 0; i < givers.length; i += 1) {
        const giver = givers[i];
        const walletAddress = await master.getWalletAddress(
            giver.address
        );

        await giverManager.sendSetWallet(
            managerOwner.getSender(),
            {
                value: toNano('0.05'),
                queryId: 100n + BigInt(i),
                giverAddress: giver.address,
                walletAddress,
            }
        );

        const giverData = await giver.getGiverData();
        assert.equal(
            giverData.walletAddress?.toString(),
            walletAddress.toString()
        );
    }

    await master.sendMint(minterAdmin.getSender(), {
        value: toNano('2'),
        queryId: 500n,
        amount: MINT_AMOUNT,
    });

    const totalSupply = await master.getTotalSupply();
    assert.equal(totalSupply, MINT_AMOUNT);

    // После автодистрибуции кошельки гиверов должны быть пустыми.
    for (const giver of givers) {
        const giverWalletBalance = await getWalletBalance(
            blockchain,
            master,
            giver.address
        );
        assert.equal(giverWalletBalance, 0n);
    }

    const balanceAllodiumFrs = await getWalletBalance(
        blockchain,
        master,
        allodiumFrs.address
    );
    const balanceAllodiumFoundation =
        await getWalletBalance(
            blockchain,
            master,
            allodiumFoundation.address
        );
    const balanceDefiBank = await getWalletBalance(
        blockchain,
        master,
        defiBank.address
    );
    const balanceDefiDual = await getWalletBalance(
        blockchain,
        master,
        defiDual.address
    );
    const balanceBankDao = await getWalletBalance(
        blockchain,
        master,
        bankDao.address
    );
    const balanceDaoFoundation = await getWalletBalance(
        blockchain,
        master,
        daoFoundation.address
    );
    const balanceBankDominum = await getWalletBalance(
        blockchain,
        master,
        bankDominum.address
    );
    const balanceDominumFoundation =
        await getWalletBalance(
            blockchain,
            master,
            dominumFoundation.address
        );
    const balanceDomTreasury = await getWalletBalance(
        blockchain,
        master,
        domTreasuryOwner.address
    );

    assert.equal(balanceAllodiumFrs, 450_000_000n);
    assert.equal(balanceAllodiumFoundation, 450_000_000n);
    assert.equal(balanceDefiBank, 250_000_000n);
    assert.equal(balanceDefiDual, 250_000_000n);
    assert.equal(balanceBankDao, 350_000_000n);
    assert.equal(balanceDaoFoundation, 350_000_000n);
    assert.equal(balanceBankDominum, 350_000_000n);
    assert.equal(balanceDominumFoundation, 350_000_000n);

    // 8 transfer-операций * 0.1 DOM налога.
    assert.equal(balanceDomTreasury, 8n * TAX_AMOUNT);

    const poolData = await gasPool.getPoolData();

    // 8 transfer-операций * 0.05 DOM комиссии в domBalance.
    assert.equal(poolData.domBalance, 8n * TAX_HALF);
});
