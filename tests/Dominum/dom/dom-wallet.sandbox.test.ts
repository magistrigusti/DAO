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

const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;
const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
const GAS_POOL = 'Dominum/treasury/GasPool' as const;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('DomWallet', () => {
  let blockchain: Blockchain;

  let admin: SandboxContract<TreasuryContract>;
  let sender: SandboxContract<TreasuryContract>;
  let receiver: SandboxContract<TreasuryContract>;
  let treasuryOwner: SandboxContract<TreasuryContract>;
  let dummyDefi: SandboxContract<TreasuryContract>;
  let dummyDao: SandboxContract<TreasuryContract>;
  let dummyDominum: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;
  let gasProxyCode: Cell;
  let gasPoolCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_WALLET);
    masterCode = await compile(DOM_MASTER);
    gasProxyCode = await compile(GAS_PROXY);
    gasPoolCode = await compile(GAS_POOL);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    admin = await blockchain.treasury('admin');
    sender = await blockchain.treasury('sender');
    receiver = await blockchain.treasury('receiver');
    treasuryOwner = await blockchain.treasury('treasury-owner');
    dummyDefi = await blockchain.treasury('dummy-defi');
    dummyDao = await blockchain.treasury('dummy-dao');
    dummyDominum = await blockchain.treasury('dummy-dominum');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployWalletFlow() {
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

    const baseNow = (blockchain.now ?? Math.floor(Date.now() / 1000)) + 1;

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

    const domMaster = blockchain.openContract(
      DomMaster.createFromConfig(
        {
          totalSupply: 0n,
          ownerAddress: admin.address,
          lastMintTime: 0n,
          isStarted: false,
          gasPoolAddress: gasProxy.address,
          giverAllodiumAddress: sender.address,
          giverDefiAddress: dummyDefi.address,
          giverDaoAddress: dummyDao.address,
          giverDominumAddress: dummyDominum.address,
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

    await domMaster.sendMint(
      admin.getSender(),
      {
        value: toNano('0.25'),
        amount: 1_000_000_000n,
        queryId: 4n,
      }
    );

    const senderWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(sender.address)
      )
    );

    return {
      domMaster,
      gasProxy,
      gasPool,
      senderWallet,
    };
  }

  it('should expose wallet data after mint', async () => {
    const {
      domMaster,
      gasProxy,
      senderWallet,
    } = await deployWalletFlow();

    const walletData = await senderWallet.getWalletData();

    expect(walletData.balance).toEqual(300_000_000n);
    expect(walletData.ownerAddress.toString()).toEqual(sender.address.toString());
    expect(walletData.masterAddress.toString()).toEqual(domMaster.address.toString());
    expect(walletData.gasPoolAddress.toString()).toEqual(gasProxy.address.toString());
  });

  it('should burn tokens and reduce total supply', async () => {
    const {
      domMaster,
      senderWallet,
    } = await deployWalletFlow();

    await senderWallet.sendBurn(
      sender.getSender(),
      {
        value: toNano('0.05'),
        amount: 50_000_000n,
        responseDestination: sender.address,
        queryId: 5n,
      }
    );

    const walletData = await senderWallet.getWalletData();
    const jettonData = await domMaster.getJettonData();

    expect(walletData.balance).toEqual(250_000_000n);
    expect(jettonData.totalSupply).toEqual(950_000_000n);
  });

  it('should reject transfer from non-owner', async () => {
    const {
      gasPool,
      senderWallet,
    } = await deployWalletFlow();

    await ignoreFailure(
      senderWallet.sendTransfer(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          jettonAmount: 100_000_000n,
          toOwner: receiver.address,
          queryId: 6n,
        }
      )
    );

    const senderWalletData = await senderWallet.getWalletData();
    const poolData = await gasPool.getPoolData();

    expect(senderWalletData.balance).toEqual(300_000_000n);
    expect(poolData.domBalance).toEqual(0n);
  });
});