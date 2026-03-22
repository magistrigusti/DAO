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

describe('DOM master mint', () => {
    let blockchain: Blockchain;

    let admin: SandboxContract<TreasuryContract>;
    let giver1: SandboxContract<TreasuryContract>;
    let giver2: SandboxContract<TreasuryContract>;
    let giver3: SandboxContract<TreasuryContract>;
    let giver4: SandboxContract<TreasuryContract>;

    let walletCode: Cell;
    let masterCode: Cell;

    beforeAll(async () => {
        walletCode = await compile('DomWallet');
        masterCode = await compile('DomMaster');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('admin');
        giver1 = await blockchain.treasury('giver1');
        giver2 = await blockchain.treasury('giver2');
        giver3 = await blockchain.treasury('giver3');
        giver4 = await blockchain.treasury('giver4');
    });

    it('should mint and split DOM to 4 givers', async () => {
        const domMaster = blockchain.openContract(
            DomMaster.createFromConfig(
                {
                    totalSupply: 0n,
                    ownerAddress: admin.address,
                    lastMintTime: 0n,
                    isStarted: false,
                    gasPoolAddress: admin.address,
                    giverAllodiumAddress: giver1.address,
                    giverDefiAddress: giver2.address,
                    giverDaoAddress: giver3.address,
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

        const mintAmount = 1_000_000_000_000n;

        await domMaster.sendMint(
            admin.getSender(),
            {
                value: toNano('0.25'),
                amount: mintAmount,
                queryId: 0n,
            }
        );

        const masterData = await domMaster.getJettonData();

        expect(masterData.totalSupply).toEqual(
            mintAmount
        );

        const w1 = await domMaster.getWalletAddress(
            giver1.address
        );
        const w2 = await domMaster.getWalletAddress(
            giver2.address
        );
        const w3 = await domMaster.getWalletAddress(
            giver3.address
        );
        const w4 = await domMaster.getWalletAddress(
            giver4.address
        );

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

        expect(d1.balance).toEqual(300_000_000_000n);
        expect(d2.balance).toEqual(200_000_000_000n);
        expect(d3.balance).toEqual(250_000_000_000n);
        expect(d4.balance).toEqual(250_000_000_000n);
    });
});