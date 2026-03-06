import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address } from '@ton/core';
import { printTransactionFees } from '@ton/sandbox';
import '@ton/test-utils';
import { DomMaster } from '../../../wrappers/DomMaster';
import { DomWallet } from '../../../wrappers/DomWallet';
import { DomMinter } from '../../../wrappers/DomMinter';
import { compile } from '@ton/blueprint';

describe('Mint flow', () => {
    let blockchain: Blockchain;
    let domMaster: SandboxContract<DomMaster>;
    let domMinter: SandboxContract<DomMinter>;
    let admin: SandboxContract<TreasuryContract>;
    let giver1: SandboxContract<TreasuryContract>;
    let giver2: SandboxContract<TreasuryContract>;
    let giver3: SandboxContract<TreasuryContract>;
    let giver4: SandboxContract<TreasuryContract>;
    let gasProxy: Address;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        admin = await blockchain.treasury('admin');
        giver1 = await blockchain.treasury('giver1');
        giver2 = await blockchain.treasury('giver2');
        giver3 = await blockchain.treasury('giver3');
        giver4 = await blockchain.treasury('giver4');

        const walletCode = Cell.fromBoc(
            (await compile('DomWallet')).code.toBoc()
        )[0];
        const masterCode = Cell.fromBoc(
            (await compile('DomMaster')).code.toBoc()
        )[0];
        const minterCode = Cell.fromBoc(
            (await compile('DomMinter')).code.toBoc()
        )[0];
        const gasPoolCode = Cell.fromBoc(
            (await compile('GasPool')).code.toBoc()
        )[0];
        const gasProxyCode = Cell.fromBoc(
            (await compile('GasProxy')).code.toBoc()
        )[0];

        const gasProxyConfig = {
            adminAddress: admin.address,
            realGasPoolAddress: Address.parseRaw('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'),
            walletConfigReady: false,
            hasPending: false,
        };
        gasProxy = GasProxy.createFromConfig(
            gasProxyConfig as any,
            gasProxyCode
        ).address;

        const gasPoolConfig = {
            adminAddress: admin.address,
            proxyAddress: gasProxy,
            domTreasuryAddress: admin.address,
            domBalance: 0n,
            tonReserve: 0n,
            hasPendingTreasury: false,
        };
        const gasPool = GasPool.createFromConfig(
            gasPoolConfig as any,
            gasPoolCode
        );
        blockchain.openContract(gasPool);
        await gasPool.init?.();

        const gasProxyFullConfig = {
            ...gasProxyConfig,
            realGasPoolAddress: gasPool.address,
        };
        const gasProxyContract = GasProxy.createFromConfig(
            gasProxyFullConfig as any,
            gasProxyCode
        );
        blockchain.openContract(gasProxyContract);
        await gasProxyContract.init?.();

        const content = Cell.EMPTY;
        const masterConfig = {
            totalSupply: 0n,
            minterAddress: Address.parseRaw('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'),
            gasPoolAddress: gasProxy,
            giverAllodiumAddress: giver1.address,
            giverDefiAddress: giver2.address,
            giverDaoAddress: giver3.address,
            giverDominumAddress: giver4.address,
            content,
            jettonWalletCode: walletCode,
        };
        domMaster = blockchain.openContract(
            DomMaster.createFromConfig(
                { ...masterConfig, minterAddress: Address.parseRaw('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c') },
                masterCode
            )
        );
        const minterConfig = {
            adminAddress: admin.address,
            masterAddress: domMaster.address,
            lastMintTime: 0n,
            isStarted: false,
        };
        domMinter = blockchain.openContract(
            DomMinter.createFromConfig(minterConfig, minterCode)
        );

        await gasProxyContract.sendSetWalletConfig(
            admin.getSender(),
            {
                value: toNano('0.05'),
                masterAddress: domMaster.address,
                jettonWalletCode: walletCode,
            } as any
        );
    });

    it('should mint and distribute to 4 givers', async () => {
        const mintAmount = 1_000_000_000_000n; // 1M DOM (6 decimals)
        const res = await domMinter.sendMint(admin.getSender(), {
            value: toNano('1'),
            amount: mintAmount,
        } as any);

        printTransactionFees(res.transactions);

        const masterData = await domMaster.getJettonData();
        expect(masterData.totalSupply).toEqual(mintAmount);

        const w1 = await domMaster.getWalletAddress(giver1.address);
        const w2 = await domMaster.getWalletAddress(giver2.address);
        const w3 = await domMaster.getWalletAddress(giver3.address);
        const w4 = await domMaster.getWalletAddress(giver4.address);

        const wallet1 = blockchain.openContract(
            DomWallet.createFromAddress(w1)
        );
        const wallet2 = blockchain.openContract(
            DomWallet.createFromAddress(w2)
        );
        const wallet3 = blockchain.openContract(
            DomWallet.createFromAddress(w3)
        );
        const wallet4 = blockchain.openContract(
            DomWallet.createFromAddress(w4)
        );

        const d1 = await wallet1.getWalletData();
        const d2 = await wallet2.getWalletData();
        const d3 = await wallet3.getWalletData();
        const d4 = await wallet4.getWalletData();

        expect(d1.balance).toEqual(300_000_000_000n); // 30%
        expect(d2.balance).toEqual(200_000_000_000n); // 20%
        expect(d3.balance).toEqual(250_000_000_000n); // 25%
        expect(d4.balance).toEqual(250_000_000_000n); // 25%
    });
});