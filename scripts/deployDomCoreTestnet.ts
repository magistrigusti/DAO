import { compile, NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { buildDomJettonContent } from './domMetadata';
import { DomMaster } from '../wrappers/DomMaster';
import { GasProxy } from '../wrappers/GasProxy';
import { GasPool } from '../wrappers/GasPool';
import { Giver } from '../wrappers/Giver';
import { GiverManager } from '../wrappers/GiverManager';

function parseAddressOrDefault(
    raw: string | undefined,
    fallback: Address
): Address {
    if (!raw || raw.trim().length === 0) {
        return fallback;
    }

    return Address.parse(raw.trim());
}

// Уникальные адреса-дискриминаторы для гиверов при деплое без args.
// Без этого все 4 гивера получают одинаковый init → один адрес → 4× TON на один контракт.
const GIVER_DISCRIMINATORS: readonly Address[] = [
    Address.parse('0:0000000000000000000000000000000000000000000000000000000000000001'),
    Address.parse('0:0000000000000000000000000000000000000000000000000000000000000002'),
    Address.parse('0:0000000000000000000000000000000000000000000000000000000000000003'),
    Address.parse('0:0000000000000000000000000000000000000000000000000000000000000004'),
] as const;

export async function run(
    provider: NetworkProvider,
    args: string[]
) {
    // Убираем MaxListenersExceededWarning при TonConnect
    process.setMaxListeners?.(20);

    // ========== ГЕРОИ В ЛОКАЦИЯХ ==========
    // args (опционально, по порядку):
    // 0: allodiumFrs
    // 1: allodiumFoundation
    // 2: defiBank
    // 3: defiDual
    // 4: bankDao
    // 5: daoFoundation
    // 6: bankDominum
    // 7: dominumFoundation
    // 8: domTreasuryOwner
    // 9: metadataBaseUrl (например https://dominum.vercel.app)
    // Если аргумент не передан: firstTarget=deployer, secondTarget=дискриминатор
    // (чтобы 4 гивера имели разные адреса; whitelist меняется через Giver Manager).
    // ======================================
    const ui = provider.ui();
    const sender = provider.sender();

    if (!sender.address) {
        throw new Error(
            'Wallet address is unavailable. Reconnect TonConnect wallet.'
        );
    }

    const deployer = sender.address;

    const allodiumFrsAddress = parseAddressOrDefault(args[0], deployer);
    const allodiumFoundationAddress = parseAddressOrDefault(
        args[1],
        GIVER_DISCRIMINATORS[0]
    );
    const defiBankAddress = parseAddressOrDefault(args[2], deployer);
    const defiDualAddress = parseAddressOrDefault(
        args[3],
        GIVER_DISCRIMINATORS[1]
    );
    const bankDaoAddress = parseAddressOrDefault(args[4], deployer);
    const daoFoundationAddress = parseAddressOrDefault(
        args[5],
        GIVER_DISCRIMINATORS[2]
    );
    const bankDominumAddress = parseAddressOrDefault(args[6], deployer);
    const dominumFoundationAddress = parseAddressOrDefault(
        args[7],
        GIVER_DISCRIMINATORS[3]
    );
    const domTreasuryOwnerAddress = parseAddressOrDefault(
        args[8],
        deployer
    );

    const metadataBaseUrl = args[9]?.trim() || undefined;

    ui.write('Compiling DOM contracts...');

    const walletCode = await compile('DomWallet');
    const masterCode = await compile('DomMaster');
    const gasProxyCode = await compile('GasProxy');
    const gasPoolCode = await compile('GasPool');
    const giverManagerCode = await compile('GiverManager');
    const giverAllodiumCode = await compile('GiverAllodium');
    const giverDefiCode = await compile('GiverDefi');
    const giverDaoCode = await compile('GiverDao');
    const giverDominumCode = await compile('GiverDominum');

    const giverManager = provider.open(
        GiverManager.createFromConfig(
            {
                ownerAddress: deployer,
            },
            giverManagerCode
        )
    );

    const giverAllodium = provider.open(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: allodiumFrsAddress,
                secondTargetAddress: allodiumFoundationAddress,
            },
            giverAllodiumCode
        )
    );

    const giverDefi = provider.open(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: defiBankAddress,
                secondTargetAddress: defiDualAddress,
            },
            giverDefiCode
        )
    );

    const giverDao = provider.open(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: bankDaoAddress,
                secondTargetAddress: daoFoundationAddress,
            },
            giverDaoCode
        )
    );

    const giverDominum = provider.open(
        Giver.createFromConfig(
            {
                managerAddress: giverManager.address,
                walletAddress: null,
                firstTargetAddress: bankDominumAddress,
                secondTargetAddress: dominumFoundationAddress,
            },
            giverDominumCode
        )
    );

    // ВАЖНО:
    // realGasPoolAddress ставим временно в deployer.
    // После деплоя gas_pool запускаем timelock запрос на
    // реальный адрес gas_pool, а подтверждение делаем через 48ч.
    const gasProxy = provider.open(
        GasProxy.createFromConfig(
            {
                adminAddress: deployer,
                realGasPoolAddress: deployer,
                walletConfigReady: false,
                hasPending: false,
            },
            gasProxyCode
        )
    );

    const gasPool = provider.open(
        GasPool.createFromConfig(
            {
                adminAddress: deployer,
                proxyAddress: gasProxy.address,
                domTreasuryAddress: domTreasuryOwnerAddress,
                domBalance: 0n,
                tonReserve: 0n,
                hasPendingTreasury: false,
            },
            gasPoolCode
        )
    );

    // На testnet используем Phase-1:
    // minterAddress = deployer wallet.
    // Это даёт возможность минтить вручную через QR без сид-фразы.
    const master = provider.open(
        DomMaster.createFromConfig(
            {
                totalSupply: 0n,
                minterAddress: deployer,
                gasPoolAddress: gasProxy.address,
                giverAllodiumAddress: giverAllodium.address,
                giverDefiAddress: giverDefi.address,
                giverDaoAddress: giverDao.address,
                giverDominumAddress: giverDominum.address,
                content: buildDomJettonContent({
                    version: 'Dv1',
                    baseUrl: metadataBaseUrl,
                }),
                jettonWalletCode: walletCode,
            },
            masterCode
        )
    );

    // ========== PREVIEW: куда и сколько ==========
    const network = provider.network();
    const fmt = (a: Address) =>
        a.toString({ testOnly: network === 'testnet', bounceable: false });
    ui.write('');
    ui.write('========== DEPLOY PLAN ==========');
    ui.write(`GiverManager  0.5 TON  → ${fmt(giverManager.address)}`);
    ui.write(`GiverAllodium 0.5 TON  → ${fmt(giverAllodium.address)}`);
    ui.write(`GiverDeFi     0.5 TON  → ${fmt(giverDefi.address)}`);
    ui.write(`GiverDAO      0.5 TON  → ${fmt(giverDao.address)}`);
    ui.write(`GiverDominum  0.5 TON  → ${fmt(giverDominum.address)}`);
    ui.write(`GasProxy      1 TON    → ${fmt(gasProxy.address)}`);
    ui.write(`GasPool       20 TON   → ${fmt(gasPool.address)}`);
    ui.write(`Master        2 TON    → ${fmt(master.address)}`);
    ui.write(`+ config: 0.2+0.2 TON (gas proxy), 0.1×4 TON (setWallet)`);
    ui.write(`TOTAL: ~26 TON`);
    ui.write('=================================');
    ui.write('');

    // ========== DEPLOY GIVER MANAGER ==========
    ui.write('Deploying giver manager...');
    if (!(await provider.isContractDeployed(giverManager.address))) {
        await giverManager.sendDeploy(provider.sender(), toNano('0.5'));
        await provider.waitForDeploy(giverManager.address);
    } else {
        ui.write('Giver manager already deployed, skipping.');
    }

    // ========== DEPLOY GIVERS (4 transactions — approve each in wallet) ==========
    const giversToDeploy = [
        { name: 'Allodium', giver: giverAllodium },
        { name: 'DeFi', giver: giverDefi },
        { name: 'DAO', giver: giverDao },
        { name: 'Dominum', giver: giverDominum },
    ] as const;

    for (let i = 0; i < giversToDeploy.length; i += 1) {
        const { name, giver } = giversToDeploy[i];
        const label = `[${i + 1}/${giversToDeploy.length}]`;
        if (await provider.isContractDeployed(giver.address)) {
            ui.write(`Giver ${name} ${label} already deployed, skipping.`);
            continue;
        }
        ui.write(`Deploying giver ${name} ${label}. Approve in wallet...`);
        await giver.sendDeploy(provider.sender(), toNano('0.5'));
        await provider.waitForDeploy(giver.address);
    }

    // ========== DEPLOY GAS PROXY & POOL ==========
    if (!(await provider.isContractDeployed(gasProxy.address))) {
        ui.write('Deploying gas proxy...');
        await gasProxy.sendDeploy(provider.sender(), toNano('1'));
        await provider.waitForDeploy(gasProxy.address);
    } else {
        ui.write('Gas proxy already deployed, skipping.');
    }

    if (!(await provider.isContractDeployed(gasPool.address))) {
        ui.write('Deploying gas pool...');
        await gasPool.sendDeploy(provider.sender(), toNano('20'));
        await provider.waitForDeploy(gasPool.address);
    } else {
        ui.write('Gas pool already deployed, skipping.');
    }

    // ========== DEPLOY MASTER ==========
    if (!(await provider.isContractDeployed(master.address))) {
        ui.write('Deploying master...');
        await master.sendDeploy(provider.sender(), toNano('2'));
        await provider.waitForDeploy(master.address);
    } else {
        ui.write('Master already deployed, skipping.');
    }

    ui.write('Configuring gas proxy wallet settings...');
    await gasProxy.sendSetWalletConfig(provider.sender(), {
        value: toNano('0.2'),
        queryId: 1n,
        masterAddress: master.address,
        walletCode,
    });

    ui.write('Starting gas pool timelock change request...');
    await gasProxy.sendRequestChangePool(provider.sender(), {
        value: toNano('0.2'),
        queryId: 2n,
        newPoolAddress: gasPool.address,
    });

    ui.write('Configuring giver wallet addresses...');
    const givers = [
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

        await giverManager.sendSetWallet(provider.sender(), {
            value: toNano('0.1'),
            queryId: 100n + BigInt(i),
            giverAddress: giver.address,
            walletAddress,
        });
    }

    ui.write('');
    ui.write('========== DEPLOY COMPLETE ==========');
    const base =
        network === 'testnet'
            ? 'https://testnet.tonscan.org/address/'
            : 'https://tonscan.org/address/';
    const contracts = [
        ['Master', master.address, '2 TON'],
        ['GasPool', gasPool.address, '20 TON'],
        ['GasProxy', gasProxy.address, '1 TON'],
        ['GiverManager', giverManager.address, '0.5 TON'],
        ['GiverAllodium', giverAllodium.address, '0.5 TON'],
        ['GiverDeFi', giverDefi.address, '0.5 TON'],
        ['GiverDAO', giverDao.address, '0.5 TON'],
        ['GiverDominum', giverDominum.address, '0.5 TON'],
    ] as const;
    for (const [name, addr, amount] of contracts) {
        const raw = fmt(addr);
        ui.write(`${name} (${amount}): ${raw}`);
        ui.write(`  → ${base}${raw}`);
    }
    ui.write('=====================================');
    ui.write(
        'Next: wait 48h, run confirmGasProxyPool. Mint: manual from deployer.'
    );
}
