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
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';

const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;
const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
const GAS_POOL = 'Dominum/treasury/GasPool' as const;
const GIVER_ALLODIUM = 'Dominum/givers/GiverAllodium' as const;

const TESTNET_FIRST_MINT = 1_000_000_000_000n;
const EXPECTED_TARGET_BALANCE = 149_850_000_000n;
const EXPECTED_TREASURY_BALANCE = 200_000_000n;
const EXPECTED_POOL_FEE_BALANCE = 100_000_000n;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('GiverAllodium', () => {
  let blockchain: Blockchain;

  let admin: SandboxContract<TreasuryContract>;
  let manager: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let treasuryOwner: SandboxContract<TreasuryContract>;
  let targetFrs: SandboxContract<TreasuryContract>;
  let targetFoundation: SandboxContract<TreasuryContract>;
  let newTargetFrs: SandboxContract<TreasuryContract>;
  let newTargetFoundation: SandboxContract<TreasuryContract>;
  let dummyDefi: SandboxContract<TreasuryContract>;
  let dummyDao: SandboxContract<TreasuryContract>;
  let dummyDominum: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;
  let gasProxyCode: Cell;
  let gasPoolCode: Cell;
  let giverCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_WALLET);
    masterCode = await compile(DOM_MASTER);
    gasProxyCode = await compile(GAS_PROXY);
    gasPoolCode = await compile(GAS_POOL);
    giverCode = await compile(GIVER_ALLODIUM);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    admin = await blockchain.treasury('admin');
    manager = await blockchain.treasury('manager');
    outsider = await blockchain.treasury('outsider');
    treasuryOwner = await blockchain.treasury('treasury-owner');
    targetFrs = await blockchain.treasury('frs-allodium');
    targetFoundation = await blockchain.treasury('allodium-foundation');
    newTargetFrs = await blockchain.treasury('new-frs-allodium');
    newTargetFoundation = await blockchain.treasury('new-allodium-foundation');
    dummyDefi = await blockchain.treasury('dummy-defi');
    dummyDao = await blockchain.treasury('dummy-dao');
    dummyDominum = await blockchain.treasury('dummy-dominum');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverAllodium.createFromConfig(
        {
          managerAddress: manager.address,
          walletAddress: null,
          frsAllodiumAddress: targetFrs.address,
          allodiumFoundationAddress: targetFoundation.address,
        },
        giverCode
      )
    );
  }

  async function deployDistributionFlow() {
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

    const giver = openGiver();

    await gasProxy.sendDeploy(
      admin.getSender(),
      toNano('0.1')
    );
    await gasPool.sendDeploy(
      admin.getSender(),
      toNano('0.1')
    );
    await giver.sendDeploy(
      admin.getSender(),
      toNano('0.05')
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
          giverAllodiumAddress: giver.address,
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

    const giverWalletAddress = await domMaster.getWalletAddress(giver.address);

    await giver.sendSetWallet(
      manager.getSender(),
      {
        value: toNano('0.05'),
        walletAddress: giverWalletAddress,
        queryId: 4n,
      }
    );

    return {
      domMaster,
      gasPool,
      giver,
      giverWalletAddress,
    };
  }

  it('should update wallet and whitelist only from manager', async () => {
    const giver = openGiver();

    await giver.sendDeploy(
      admin.getSender(),
      toNano('0.05')
    );

    await ignoreFailure(
      giver.sendSetWallet(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          walletAddress: treasuryOwner.address,
          queryId: 5n,
        }
      )
    );

    let giverData = await giver.getGiverData();

    expect(giverData.walletAddress).toBeNull();

    await giver.sendSetWallet(
      manager.getSender(),
      {
        value: toNano('0.05'),
        walletAddress: treasuryOwner.address,
        queryId: 6n,
      }
    );

    await ignoreFailure(
      giver.sendChangeWhitelist(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          frsAllodiumAddress: newTargetFrs.address,
          allodiumFoundationAddress: newTargetFoundation.address,
          queryId: 7n,
        }
      )
    );

    giverData = await giver.getGiverData();

    expect(giverData.walletAddress?.toString()).toEqual(treasuryOwner.address.toString());
    expect(giverData.frsAllodiumAddress.toString()).toEqual(targetFrs.address.toString());
    expect(giverData.allodiumFoundationAddress.toString()).toEqual(targetFoundation.address.toString());

    await giver.sendChangeWhitelist(
      manager.getSender(),
      {
        value: toNano('0.05'),
        frsAllodiumAddress: newTargetFrs.address,
        allodiumFoundationAddress: newTargetFoundation.address,
        queryId: 8n,
      }
    );

    giverData = await giver.getGiverData();

    expect(giverData.frsAllodiumAddress.toString()).toEqual(newTargetFrs.address.toString());
    expect(giverData.allodiumFoundationAddress.toString()).toEqual(newTargetFoundation.address.toString());
  });

  it('should auto-distribute minted DOM between FRS and foundation', async () => {
    const {
      domMaster,
      gasPool,
      giver,
      giverWalletAddress,
    } = await deployDistributionFlow();

    await domMaster.sendMint(
      admin.getSender(),
      {
        value: toNano('0.25'),
        amount: TESTNET_FIRST_MINT,
        queryId: 9n,
      }
    );

    const targetFrsWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(targetFrs.address)
      )
    );
    const targetFoundationWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(targetFoundation.address)
      )
    );
    const treasuryWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(treasuryOwner.address)
      )
    );
    const giverWallet = blockchain.openContract(
      DomWallet.createFromAddress(giverWalletAddress)
    );

    const giverData = await giver.getGiverData();
    const poolData = await gasPool.getPoolData();
    const frsData = await targetFrsWallet.getWalletData();
    const foundationData = await targetFoundationWallet.getWalletData();
    const treasuryData = await treasuryWallet.getWalletData();
    const giverWalletData = await giverWallet.getWalletData();

    expect(giverData.walletAddress?.toString()).toEqual(giverWalletAddress.toString());
    expect(frsData.balance).toEqual(EXPECTED_TARGET_BALANCE);
    expect(foundationData.balance).toEqual(EXPECTED_TARGET_BALANCE);
    expect(treasuryData.balance).toEqual(EXPECTED_TREASURY_BALANCE);
    expect(giverWalletData.balance).toEqual(0n);
    expect(poolData.domBalance).toEqual(EXPECTED_POOL_FEE_BALANCE);
  });
});