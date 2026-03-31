// =====================================================
// DEPLOY DOM MINT — Пробный деплой + первый минт DOM
// =====================================================
// Порядок:
// 1. GasProxy (временный realGasPoolAddress = deployer)
// 2. GasPool  (proxyAddress = gasProxy)
// 3. 4 Givers (managerAddress = deployer на время testnet)
// 4. GiverManager (ownerAddress = deployer)
// 5. DomMaster (owner, gasProxy, 4 givers, content, walletCode)
// 6. GasProxy.sendSetWalletConfig
// 7. GasProxy.sendRequestChangePool → sendConfirmChangePool
// 8. DomMaster.sendMint — ПЕРВЫЙ МИНТ
// =====================================================

import { toNano, Address } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';

import { buildOffChainContent } from './helpers/buildContent';

import { DomMaster } from '../wrappers/Dominum/dom/DomMaster';
import { GasProxy } from '../wrappers/Dominum/treasury/GasProxy';
import { GasPool } from '../wrappers/Dominum/treasury/GasPool';

import {
    GiverAllodium,
} from '../wrappers/Dominum/givers/GiverAllodium';
import {
    GiverDefi,
} from '../wrappers/Dominum/givers/GiverDefi';
import {
    GiverDao,
} from '../wrappers/Dominum/givers/GiverDao';
import {
    GiverDominum,
} from '../wrappers/Dominum/givers/GiverDominum';
import {
    GiverManager,
} from '../wrappers/Dominum/management/GiverManager';

// ========== КОНФИГУРАЦИЯ ==========
const METADATA_URL =
    'https://raw.githubusercontent.com/magistrigusti/DAO/main/metadata/dom-metadata.json';

// Пробный минт: 1000 DOM (с 6 decimals)
const FIRST_MINT_AMOUNT = 1_000_000_000n;

// TIMELOCK на testnet = 60 секунд
const TIMELOCK_WAIT_MS = 65_000;

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const sender = provider.sender();
    const deployer = sender.address!;

    ui.write('========== DOM DEPLOY START ==========');
    ui.write(`Deployer: ${deployer.toString()}`);

    // ========== КОМПИЛЯЦИЯ ==========
    ui.write('Compiling contracts...');

    const walletCode = await compile('DomWallet');
    const masterCode = await compile('DomMaster');
    const gasProxyCode = await compile('GasProxy');
    const gasPoolCode = await compile('GasPool');
    const giverAllodiumCode = await compile('GiverAllodium');
    const giverDefiCode = await compile('GiverDefi');
    const giverDaoCode = await compile('GiverDao');
    const giverDominumCode = await compile('GiverDominum');
    const giverManagerCode = await compile('GiverManager');

    ui.write('All contracts compiled.');

    // ========== 1. DEPLOY GAS PROXY ==========
    ui.write('--- Step 1: Deploy GasProxy ---');

    const gasProxy = provider.open(
        GasProxy.createFromConfig(
            {
                adminAddress: deployer,
                realGasPoolAddress: deployer,
            },
            gasProxyCode
        )
    );

    await gasProxy.sendDeploy(sender, toNano('0.1'));
    await provider.waitForDeploy(gasProxy.address);
    ui.write(`GasProxy: ${gasProxy.address.toString()}`);

    // ========== 2. DEPLOY GAS POOL ==========
    ui.write('--- Step 2: Deploy GasPool ---');

    const gasPool = provider.open(
        GasPool.createFromConfig(
            {
                adminAddress: deployer,
                proxyAddress: gasProxy.address,
                domTreasuryAddress: deployer,
                domBalance: 0n,
                tonReserve: 0n,
            },
            gasPoolCode
        )
    );

    await gasPool.sendDeploy(sender, toNano('0.5'));
    await provider.waitForDeploy(gasPool.address);
    ui.write(`GasPool: ${gasPool.address.toString()}`);

    // ========== 3. DEPLOY 4 GIVERS ==========
    // На testnet: deployer как временный target
    // Позже через GiverManager.sendChangeWhitelist поменяем
    ui.write('--- Step 3: Deploy 4 Givers ---');

    const giverAllodium = provider.open(
        GiverAllodium.createFromConfig(
            {
                managerAddress: deployer,
                frsAllodiumAddress: deployer,
                allodiumFoundationAddress: deployer,
            },
            giverAllodiumCode
        )
    );
    await giverAllodium.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(giverAllodium.address);
    ui.write(`GiverAllodium: ${giverAllodium.address}`);

    const giverDefi = provider.open(
        GiverDefi.createFromConfig(
            {
                managerAddress: deployer,
                defiBankAddress: deployer,
                defiDualAddress: deployer,
            },
            giverDefiCode
        )
    );
    await giverDefi.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(giverDefi.address);
    ui.write(`GiverDefi: ${giverDefi.address}`);

    const giverDao = provider.open(
        GiverDao.createFromConfig(
            {
                managerAddress: deployer,
                bankDaoAddress: deployer,
                daoFoundationAddress: deployer,
            },
            giverDaoCode
        )
    );
    await giverDao.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(giverDao.address);
    ui.write(`GiverDao: ${giverDao.address}`);

    const giverDominum = provider.open(
        GiverDominum.createFromConfig(
            {
                managerAddress: deployer,
                bankDominumAddress: deployer,
                dominumFoundationAddress: deployer,
            },
            giverDominumCode
        )
    );
    await giverDominum.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(giverDominum.address);
    ui.write(`GiverDominum: ${giverDominum.address}`);

    // ========== 4. DEPLOY GIVER MANAGER ==========
    ui.write('--- Step 4: Deploy GiverManager ---');

    const giverManager = provider.open(
        GiverManager.createFromConfig(
            { ownerAddress: deployer },
            giverManagerCode
        )
    );
    await giverManager.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(giverManager.address);
    ui.write(`GiverManager: ${giverManager.address}`);

    // ========== 5. DEPLOY DOM MASTER ==========
    ui.write('--- Step 5: Deploy DomMaster ---');

    const content = buildOffChainContent(METADATA_URL);

    const domMaster = provider.open(
        DomMaster.createFromConfig(
            {
                totalSupply: 0n,
                ownerAddress: deployer,
                lastMintTime: 0n,
                isStarted: false,
                gasPoolAddress: gasProxy.address,
                giverAllodiumAddress: giverAllodium.address,
                giverDefiAddress: giverDefi.address,
                giverDaoAddress: giverDao.address,
                giverDominumAddress: giverDominum.address,
                content,
                jettonWalletCode: walletCode,
            },
            masterCode
        )
    );

    await domMaster.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(domMaster.address);
    ui.write(`DomMaster: ${domMaster.address}`);

    // ========== 6. GAS PROXY: SET WALLET CONFIG ==========
    ui.write('--- Step 6: GasProxy.sendSetWalletConfig ---');

    await gasProxy.sendSetWalletConfig(sender, {
        value: toNano('0.05'),
        masterAddress: domMaster.address,
        jettonWalletCode: walletCode,
    });

    ui.write('WalletConfig set on GasProxy.');

    // ========== 7. GAS PROXY: CHANGE POOL (TIMELOCK) ==========
    ui.write('--- Step 7: GasProxy.requestChangePool ---');

    await gasProxy.sendRequestChangePool(sender, {
        value: toNano('0.05'),
        newGasPoolAddress: gasPool.address,
    });

    ui.write(
        `Timelock started. Waiting ${TIMELOCK_WAIT_MS / 1000}s...`
    );
    await sleep(TIMELOCK_WAIT_MS);

    await gasProxy.sendConfirmChangePool(sender, {
        value: toNano('0.05'),
    });

    ui.write('GasProxy now points to real GasPool.');

    // ========== 8. ПЕРВЫЙ МИНТ ==========
    ui.write('--- Step 8: FIRST MINT ---');
    ui.write(`Minting ${FIRST_MINT_AMOUNT} DOM units...`);

    await domMaster.sendMint(sender, {
        value: toNano('0.25'),
        amount: FIRST_MINT_AMOUNT,
    });

    ui.write('========== MINT SENT ==========');
    ui.write('');
    ui.write('=== DEPLOYED ADDRESSES ===');
    ui.write(`DomMaster:     ${domMaster.address}`);
    ui.write(`GasProxy:      ${gasProxy.address}`);
    ui.write(`GasPool:       ${gasPool.address}`);
    ui.write(`GiverAllodium: ${giverAllodium.address}`);
    ui.write(`GiverDefi:     ${giverDefi.address}`);
    ui.write(`GiverDao:      ${giverDao.address}`);
    ui.write(`GiverDominum:  ${giverDominum.address}`);
    ui.write(`GiverManager:  ${giverManager.address}`);
    ui.write('==========================');
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
