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

const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('DomMaster', () => {
  let blockchain: Blockchain;

  let admin: SandboxContract<TreasuryContract>;
  let giverAllodium: SandboxContract<TreasuryContract>;
  let giverDefi: SandboxContract<TreasuryContract>;
  let giverDao: SandboxContract<TreasuryContract>;
  let giverDominum: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_WALLET);
    masterCode = await compile(DOM_MASTER);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    admin = await blockchain.treasury('admin');
    giverAllodium = await blockchain.treasury('giver-allodium');
    giverDefi = await blockchain.treasury('giver-defi');
    giverDao = await blockchain.treasury('giver-dao');
    giverDominum = await blockchain.treasury('giver-dominum');
    outsider = await blockchain.treasury('outsider');
  });

  function openMaster() {
    return blockchain.openContract(
      DomMaster.createFromConfig(
        {
          totalSupply: 0n,
          ownerAddress: admin.address,
          lastMintTime: 0n,
          isStarted: false,
          gasPoolAddress: admin.address,
          giverAllodiumAddress: giverAllodium.address,
          giverDefiAddress: giverDefi.address,
          giverDaoAddress: giverDao.address,
          giverDominumAddress: giverDominum.address,
          content: beginCell().endCell(),
          jettonWalletCode: walletCode,
        },
        masterCode
      )
    );
  }

  it('should expose testnet mint rules', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    const rules = await domMaster.getMintRules();

    expect(rules.minMintAmount).toEqual(1_000_000n);
    expect(rules.maxMintAmount).toEqual(1_000_000_000_000n);
    expect(rules.mintInterval).toEqual(3600n);
    expect(await domMaster.getCanMintNow()).toBe(true);
  });

  it('should mint 1_000_000 DOM and split supply between 4 givers', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    await domMaster.sendMint(
      admin.getSender(),
      {
        value: toNano('0.25'),
        amount: 1_000_000_000_000n,
        queryId: 1n,
      }
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(1_000_000_000_000n);

    const walletAllodium = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(giverAllodium.address)
      )
    );
    const walletDefi = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(giverDefi.address)
      )
    );
    const walletDao = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(giverDao.address)
      )
    );
    const walletDominum = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(giverDominum.address)
      )
    );

    expect((await walletAllodium.getWalletData()).balance).toEqual(300_000_000_000n);
    expect((await walletDefi.getWalletData()).balance).toEqual(200_000_000_000n);
    expect((await walletDao.getWalletData()).balance).toEqual(250_000_000_000n);
    expect((await walletDominum.getWalletData()).balance).toEqual(250_000_000_000n);
  });

  it('should reject second mint before one hour interval', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    await domMaster.sendMint(
      admin.getSender(),
      {
        value: toNano('0.25'),
        amount: 1_000_000_000_000n,
        queryId: 2n,
      }
    );

    await ignoreFailure(
      domMaster.sendMint(
        admin.getSender(),
        {
          value: toNano('0.25'),
          amount: 1_000_000_000_000n,
          queryId: 3n,
        }
      )
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(1_000_000_000_000n);
    expect(await domMaster.getCanMintNow()).toBe(false);
  });

  it('should allow second mint after one hour', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    await domMaster.sendMint(
      admin.getSender(),
      {
        value: toNano('0.25'),
        amount: 1_000_000_000_000n,
        queryId: 4n,
      }
    );

    const masterData = await domMaster.getMasterData();

    blockchain.now = Number(masterData.lastMintTime + 3601n);

    await domMaster.sendMint(
      admin.getSender(),
      {
        value: toNano('0.25'),
        amount: 1_000_000_000_000n,
        queryId: 5n,
      }
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(2_000_000_000_000n);
  });

  it('should reject mint above testnet max amount', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    await ignoreFailure(
      domMaster.sendMint(
        admin.getSender(),
        {
          value: toNano('0.25'),
          amount: 1_000_000_000_001n,
          queryId: 6n,
        }
      )
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(0n);
    expect(await domMaster.getCanMintNow()).toBe(true);
  });

  it('should reject mint from non-owner', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    await ignoreFailure(
      domMaster.sendMint(
        outsider.getSender(),
        {
          value: toNano('0.25'),
          amount: 1_000_000_000_000n,
          queryId: 7n,
        }
      )
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(0n);
  });
});