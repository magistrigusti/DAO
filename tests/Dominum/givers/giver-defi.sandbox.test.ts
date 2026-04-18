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
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';

const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;
const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
const GAS_POOL = 'Dominum/treasury/GasPool' as const;
const GIVER_DEFI = 'Dominum/givers/GiverDefi' as const;

const TESTNET_FIRST_MINT = 1_000_000_000_000n;
const EXPECTED_TARGET_BALANCE = 99_850_000_000n;
const EXPECTED_TREASURY_BALANCE = 200_000_000n;
const EXPECTED_POOL_FEE_BALANCE = 100_000_000n;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('GiverDefi', () => {
  let blockchain: Blockchain;

  let admin: SandboxContract<TreasuryContract>;
  let manager: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let treasuryOwner: SandboxContract<TreasuryContract>;
  let defiBank: SandboxContract<TreasuryContract>;
  let defiDual: SandboxContract<TreasuryContract>;
  let newDefiBank: SandboxContract<TreasuryContract>;
  let newDefiDual: SandboxContract<TreasuryContract>;
  let dummyAllodium: SandboxContract<TreasuryContract>;
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
    giverCode = await compile(GIVER_DEFI);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    admin = await blockchain.treasury('admin');
    manager = await blockchain.treasury('manager');
    outsider = await blockchain.treasury('outsider');
    treasuryOwner = await blockchain.treasury('treasury-owner');
    defiBank = await blockchain.treasury('defi-bank');
    defiDual = await blockchain.treasury('defi-dual');
    newDefiBank = await blockchain.treasury('new-defi-bank');
    newDefiDual = await blockchain.treasury('new-defi-dual');
    dummyAllodium = await blockchain.treasury('dummy-allodium');
    dummyDao = await blockchain.treasury('dummy-dao');
    dummyDominum = await blockchain.treasury('dummy-dominum');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverDefi.createFromConfig(
        {
          managerAddress: manager.address,
          walletAddress: null,
          defiBankAddress: defiBank.address,
          defiDualAddress: defiDual.address,
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
          giverAllodiumAddress: dummyAllodium.address,
          giverDefiAddress: giver.address,
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
          defiBankAddress: newDefiBank.address,
          defiDualAddress: newDefiDual.address,
          queryId: 7n,
        }
      )
    );

    giverData = await giver.getGiverData();

    expect(giverData.walletAddress?.toString()).toEqual(treasuryOwner.address.toString());
    expect(giverData.defiBankAddress.toString()).toEqual(defiBank.address.toString());
    expect(giverData.defiDualAddress.toString()).toEqual(defiDual.address.toString());

    await giver.sendChangeWhitelist(
      manager.getSender(),
      {
        value: toNano('0.05'),
        defiBankAddress: newDefiBank.address,
        defiDualAddress: newDefiDual.address,
        queryId: 8n,
      }
    );

    giverData = await giver.getGiverData();

    expect(giverData.defiBankAddress.toString()).toEqual(newDefiBank.address.toString());
    expect(giverData.defiDualAddress.toString()).toEqual(newDefiDual.address.toString());
  });

  it('should auto-distribute minted DOM between DeFi bank and DeFi dual', async () => {
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

    const defiBankWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(defiBank.address)
      )
    );
    const defiDualWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(defiDual.address)
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
    const bankData = await defiBankWallet.getWalletData();
    const dualData = await defiDualWallet.getWalletData();
    const treasuryData = await treasuryWallet.getWalletData();
    const giverWalletData = await giverWallet.getWalletData();

    expect(giverData.walletAddress?.toString()).toEqual(giverWalletAddress.toString());
    expect(bankData.balance).toEqual(EXPECTED_TARGET_BALANCE);
    expect(dualData.balance).toEqual(EXPECTED_TARGET_BALANCE);
    expect(treasuryData.balance).toEqual(EXPECTED_TREASURY_BALANCE);
    expect(giverWalletData.balance).toEqual(0n);
    expect(poolData.domBalance).toEqual(EXPECTED_POOL_FEE_BALANCE);
  });
});