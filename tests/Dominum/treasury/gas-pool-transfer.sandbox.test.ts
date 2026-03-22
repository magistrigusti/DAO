/// <reference types="jest" />

import {
    Blockchain,
    SandboxContract,
    TreasuryContract,
} from '@ton/sandbox';
import {
    beginCell,
    Cell,
    toNano,
} from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GasPool } from '../../../wrappers/Dominum/treasury/GasPool';
import { GasProxy } from '../../../wrappers/Dominum/treasury/GasProxy';

describe('Gas Pool transfer', () => {
    let blockchain: Blockchain;

    let admin: SandboxContract<TreasuryContract>;
    let sender: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;
    let treasuryOwner: SandboxContract<TreasuryContract>;
    let giver4: SandboxContract<TreasuryContract>;

    let walletCode: Cell;
    let masterCode: Cell;
    let gasPoolCode: Cell;
    let gasProxyCode: Cell;

    beforeAll(async () => {
        walletCode = await compile('DomWallet');
        masterCode = await compile('DomMaster');
        gasPoolCode = await compile('GasPool');
        gasProxyCode = await compile('GasProxy');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('admin');
        sender = await blockchain.treasury('sender');
        receiver = await blockchain.treasury('receiver');
        treasuryOwner = await blockchain.treasury('treasury');
        giver4 = await blockchain.treasury('giver4');
    });

    it('should route wallet transfer through proxy and gas pool', async () => {
        // ========== DEPLOY PROXY / POOL ==========
        // Цикл адресов разрываем так:
        // 1) proxy деплоим с временным realGasPoolAddress
        // 2) pool получает уже финальный proxyAddress
        // 3) потом через timelock proxy переключаем на реальный pool
        const gasProxy = blockchain.openContract(
            GasProxy.createFromConfig(
                {
                    adminAddress: admin.address,
                    realGasPoolAddress: admin.address,
                },
                gasProxyCode
            )
        );

        const gasPool = blockchain.openContract(
            GasPool.createFromConfig(
                {
                    adminAddress: admin.address,
                    proxyAddress: gasProxy.address,
                    domTreasuryAddress: treasuryOwner.address,
                    domBalance: 0n,
                    tonReserve: 0n,
                },
                gasPoolCode
            )
        );

        await gasProxy.sendDeploy(
            admin.getSender(),
            toNano('0.1')
        );

        await gasPool.sendDeploy(
            admin.getSender(),
            toNano('0.1')
        );

        const baseNow =
            (blockchain.now ?? Math.floor(Date.now() / 1000))
            + 1;

        blockchain.now = baseNow;

        await gasProxy.sendRequestChangePool(
            admin.getSender(),
            {
                value: toNano('0.05'),
                newGasPoolAddress: gasPool.address,
                queryId: 1n,
            }
        );

        blockchain.now = baseNow + 61;

        await gasProxy.sendConfirmChangePool(
            admin.getSender(),
            {
                value: toNano('0.05'),
                queryId: 2n,
            }
        );

        // ========== DEPLOY MASTER ==========
        const domMaster = blockchain.openContract(
            DomMaster.createFromConfig(
                {
                    totalSupply: 0n,
                    ownerAddress: admin.address,
                    lastMintTime: 0n,
                    isStarted: false,
                    gasPoolAddress: gasProxy.address,
                    giverAllodiumAddress: sender.address,
                    giverDefiAddress: receiver.address,
                    giverDaoAddress: treasuryOwner.address,
                    giverDominumAddress: giver4.address,
                    content: beginCell().endCell(),
                    jettonWalletCode: walletCode,
                },
                masterCode
            )
        );

        await domMaster.sendDeploy(
            admin.getSender(),
            toNano('0.05')
        );

        await gasProxy.sendSetWalletConfig(
            admin.getSender(),
            {
                value: toNano('0.05'),
                masterAddress: domMaster.address,
                jettonWalletCode: walletCode,
                queryId: 3n,
            }
        );

        // ========== MINT TO SENDER ==========
        await domMaster.sendMint(
            admin.getSender(),
            {
                value: toNano('0.25'),
                amount: 1_000_000_000n,
                queryId: 4n,
            }
        );

        const senderWalletAddress =
            await domMaster.getWalletAddress(
                sender.address
            );

        const receiverWalletAddress =
            await domMaster.getWalletAddress(
                receiver.address
            );

        const treasuryWalletAddress =
            await domMaster.getWalletAddress(
                treasuryOwner.address
            );

        const senderWallet = blockchain.openContract(
            DomWallet.createFromAddress(senderWalletAddress)
        );

        await senderWallet.sendTransfer(
            sender.getSender(),
            {
                value: toNano('0.05'),
                jettonAmount: 100_000_000n,
                toOwner: receiver.address,
                queryId: 5n,
            }
        );

        const receiverWallet = blockchain.openContract(
            DomWallet.createFromAddress(receiverWalletAddress)
        );

        const treasuryWallet = blockchain.openContract(
            DomWallet.createFromAddress(treasuryWalletAddress)
        );

        const proxyData = await gasProxy.getProxyData();
        const poolData = await gasPool.getPoolData();
        const senderData = await senderWallet.getWalletData();
        const receiverData =
            await receiverWallet.getWalletData();
        const treasuryData =
            await treasuryWallet.getWalletData();

        expect(
            proxyData.realGasPoolAddress.toString()
        ).toEqual(
            gasPool.address.toString()
        );

        expect(senderData.balance).toEqual(50_000_000n);
        expect(receiverData.balance).toEqual(300_000_000n);
        expect(treasuryData.balance).toEqual(350_000_000n);
        expect(poolData.domBalance).toEqual(50_000_000n);
    });
});