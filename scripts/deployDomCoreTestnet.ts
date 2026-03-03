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

export async function run(
    provider: NetworkProvider,
    args: string[]
) {
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
    // Если аргумент не передан — берём адрес текущего wallet sender.
    // ======================================
    const ui = provider.ui();
    const sender = provider.sender();

    if (!sender.address) {
        throw new Error(
            'Wallet address is unavailable. Reconnect TonConnect wallet.'
        );
    }

    const deployer = sender.address;

    const allodiumFrsAddress = parseAddressOrDefault(
        args[0],
        deployer
    );
    const allodiumFoundationAddress = parseAddressOrDefault(
        args[1],
        deployer
    );
    const defiBankAddress = parseAddressOrDefault(
        args[2],
        deployer
    );
    const defiDualAddress = parseAddressOrDefault(
        args[3],
        deployer
    );
    const bankDaoAddress = parseAddressOrDefault(
        args[4],
        deployer
    );
    const daoFoundationAddress = parseAddressOrDefault(
        args[5],
        deployer
    );
    const bankDominumAddress = parseAddressOrDefault(
        args[6],
        deployer
    );
    const dominumFoundationAddress = parseAddressOrDefault(
        args[7],
        deployer
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

    ui.write('Deploying giver manager...');
    await giverManager.sendDeploy(provider.sender(), toNano('0.5'));
    await provider.waitForDeploy(giverManager.address);

    ui.write('Deploying givers...');
    await giverAllodium.sendDeploy(provider.sender(), toNano('3'));
    await provider.waitForDeploy(giverAllodium.address);

    await giverDefi.sendDeploy(provider.sender(), toNano('3'));
    await provider.waitForDeploy(giverDefi.address);

    await giverDao.sendDeploy(provider.sender(), toNano('3'));
    await provider.waitForDeploy(giverDao.address);

    await giverDominum.sendDeploy(provider.sender(), toNano('3'));
    await provider.waitForDeploy(giverDominum.address);

    ui.write('Deploying gas proxy...');
    await gasProxy.sendDeploy(provider.sender(), toNano('1'));
    await provider.waitForDeploy(gasProxy.address);

    ui.write('Deploying gas pool...');
    await gasPool.sendDeploy(provider.sender(), toNano('20'));
    await provider.waitForDeploy(gasPool.address);

    ui.write('Deploying master...');
    await master.sendDeploy(provider.sender(), toNano('2'));
    await provider.waitForDeploy(master.address);

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
    ui.write('DOM core deployment completed.');
    ui.write(`Master: ${master.address.toString()}`);
    ui.write(`GasProxy: ${gasProxy.address.toString()}`);
    ui.write(`GasPool: ${gasPool.address.toString()}`);
    ui.write(`GiverManager: ${giverManager.address.toString()}`);
    ui.write(`GiverAllodium: ${giverAllodium.address.toString()}`);
    ui.write(`GiverDefi: ${giverDefi.address.toString()}`);
    ui.write(`GiverDao: ${giverDao.address.toString()}`);
    ui.write(`GiverDominum: ${giverDominum.address.toString()}`);
    ui.write('');
    ui.write(
        'Next step: wait 48h and run confirmGasProxyPool with GasProxy address.'
    );
    ui.write(
        'Mint for Phase-1 is manual from deployer wallet (master minter).'
    );
}
