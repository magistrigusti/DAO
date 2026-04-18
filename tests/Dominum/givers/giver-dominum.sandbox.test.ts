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
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';

const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;
const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
const GAS_POOL = 'Dominum/treasury/GasPool' as const;
const GIVER_DOMINUM = 'Dominum/givers/GiverDominum' as const;

const TESTNET_FIRST_MINT = 1_000_000_000_000n;
const EXPECTED_TARGET_BALANCE = 124_850_000_000n;
const EXPECTED_TREASURY_BALANCE = 200_000_000n;
const EXPECTED_POOL_FEE_BALANCE = 100_000_000n;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('GiverDominum', () => {
  let blockchain: Blockchain;

  let admin: SandboxContract<TreasuryContract>;
  let manager: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let treasuryOwner: SandboxContract<TreasuryContract>;
  let bankDominum: SandboxContract<TreasuryContract>;
  let dominumFoundation: SandboxContract<TreasuryContract>;
  let newBankDominum: SandboxContract<TreasuryContract>;
  let newDominumFoundation: SandboxContract<TreasuryContract>;
  let dummyAllodium: SandboxContract<TreasuryContract>;
  let dummyDefi: SandboxContract<TreasuryContract>;
  let dummyDao: SandboxContract<TreasuryContract>;

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
    giverCode = await compile(GIVER_DOMINUM);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    admin = await blockchain.treasury('admin');
    manager = await blockchain.treasury('manager');
    outsider = await blockchain.treasury('outsider');
    treasuryOwner = await blockchain.treasury('treasury-owner');
    bankDominum = await blockchain.treasury('bank-dominum');
    dominumFoundation = await blockchain.treasury('dominum-foundation');
    newBankDominum = await blockchain.treasury('new-bank-dominum');
    newDominumFoundation = await blockchain.treasury('new-dominum-foundation');
    dummyAllodium = await blockchain.treasury('dummy-allodium');
    dummyDefi = await blockchain.treasury('dummy-defi');
    dummyDao = await blockchain.treasury('dummy-dao');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverDominum.createFromConfig(
        {
          managerAddress: manager.address,
          walletAddress: null,
          bankDominumAddress: bankDominum.address,
          dominumFoundationAddress: dominumFoundation.address,
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
          giverDefiAddress: dummyDefi.address,
          giverDaoAddress: dummyDao.address,
          giverDominumAddress: giver.address,
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
          bankDominumAddress: newBankDominum.address,
          dominumFoundationAddress: newDominumFoundation.address,
          queryId: 7n,
        }
      )
    );

    giverData = await giver.getGiverData();

    expect(giverData.walletAddress?.toString()).toEqual(treasuryOwner.address.toString());
    expect(giverData.bankDominumAddress.toString()).toEqual(bankDominum.address.toString());
    expect(giverData.dominumFoundationAddress.toString()).toEqual(dominumFoundation.address.toString());

    await giver.sendChangeWhitelist(
      manager.getSender(),
      {
        value: toNano('0.05'),
        bankDominumAddress: newBankDominum.address,
        dominumFoundationAddress: newDominumFoundation.address,
        queryId: 8n,
      }
    );

    giverData = await giver.getGiverData();

    expect(giverData.bankDominumAddress.toString()).toEqual(newBankDominum.address.toString());
    expect(giverData.dominumFoundationAddress.toString()).toEqual(newDominumFoundation.address.toString());
  });

  it('should auto-distribute minted DOM between Dominum bank and foundation', async () => {
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

    const bankWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(bankDominum.address)
      )
    );
    const foundationWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(dominumFoundation.address)
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
    const bankData = await bankWallet.getWalletData();
    const foundationData = await foundationWallet.getWalletData();
    const treasuryData = await treasuryWallet.getWalletData();
    const giverWalletData = await giverWallet.getWalletData();

    expect(giverData.walletAddress?.toString()).toEqual(giverWalletAddress.toString());
    expect(bankData.balance).toEqual(EXPECTED_TARGET_BALANCE);
    expect(foundationData.balance).toEqual(EXPECTED_TARGET_BALANCE);
    expect(treasuryData.balance).toEqual(EXPECTED_TREASURY_BALANCE);
    expect(giverWalletData.balance).toEqual(0n);
    expect(poolData.domBalance).toEqual(EXPECTED_POOL_FEE_BALANCE);
  });
});