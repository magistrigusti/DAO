/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  Cell,
  toNano,
} from '@ton/core';
import { compile } from '@ton/blueprint';

import { TreasuryPool } from '../../../wrappers/Dominum/treasury/TreasuryPool';

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

function expectAddress(
  actual: { toString(): string },
  expected: { toString(): string }
) {
  expect(actual.toString()).toEqual(expected.toString());
}

describe('TreasuryPool', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let treasuryManager: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let bankDao: SandboxContract<TreasuryContract>;
  let bankDefi: SandboxContract<TreasuryContract>;
  let bankDominum: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let newGasPool: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let treasuryPoolCode: Cell;

  beforeAll(async () => {
    treasuryPoolCode = await compile('Dominum/treasury/TreasuryPool');
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    treasuryManager = await blockchain.treasury('treasury-manager');
    wallet = await blockchain.treasury('wallet');
    bankDao = await blockchain.treasury('bank-dao');
    bankDefi = await blockchain.treasury('bank-defi');
    bankDominum = await blockchain.treasury('bank-dominum');
    gasPool = await blockchain.treasury('gas-pool');
    newGasPool = await blockchain.treasury('new-gas-pool');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployPool() {
    const treasuryPool = blockchain.openContract(
      TreasuryPool.createFromConfig(
        {
          ownerAddress: owner.address,
          treasuryManagerAddress: treasuryManager.address,
          jettonWalletAddress: wallet.address,
          walletConfigured: false,

          bankDaoAddress: bankDao.address,
          bankDefiAddress: bankDefi.address,
          bankDominumAddress: bankDominum.address,
          gasPoolAddress: gasPool.address,
        },
        treasuryPoolCode
      )
    );

    await treasuryPool.sendDeploy(
      owner.getSender(),
      toNano('0.2')
    );

    return treasuryPool;
  }

  it('should expose treasury state and allowed targets', async () => {
    const treasuryPool = await deployPool();
    const data = await treasuryPool.getTreasuryPoolData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.treasuryManagerAddress, treasuryManager.address);
    expectAddress(data.jettonWalletAddress, wallet.address);

    expect(data.walletConfigured).toBe(false);
    expect(data.taxMultiplier).toEqual(300n);
    expect(data.totalReceivedDom).toEqual(0n);
    expect(data.totalSentDom).toEqual(0n);
    expect(data.totalSentTon).toEqual(0n);

    expect(await treasuryPool.isTreasuryTargetAllowed(bankDao.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(bankDefi.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(bankDominum.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(gasPool.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(outsider.address)).toBe(false);
  });

  it('should initialize treasury DOM wallet only from owner', async () => {
    const treasuryPool = await deployPool();

    await ignoreFailure(
      treasuryPool.sendInitTreasuryWalletConfig(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          jettonWalletAddress: outsider.address,
          queryId: 31n,
        }
      )
    );

    let data = await treasuryPool.getTreasuryPoolData();

    expect(data.walletConfigured).toBe(false);
    expectAddress(data.jettonWalletAddress, wallet.address);

    await treasuryPool.sendInitTreasuryWalletConfig(
      owner.getSender(),
      {
        value: toNano('0.05'),
        jettonWalletAddress: wallet.address,
        queryId: 32n,
      }
    );

    data = await treasuryPool.getTreasuryPoolData();

    expect(data.walletConfigured).toBe(true);
    expectAddress(data.jettonWalletAddress, wallet.address);
  });

  it('should create pending address change from treasury manager and confirm by owner', async () => {
    const treasuryPool = await deployPool();

    await treasuryPool.sendReplaceAddressRequest(
      treasuryManager.getSender(),
      {
        value: toNano('0.05'),
        oldAddress: gasPool.address,
        newAddress: newGasPool.address,
        queryId: 33n,
      }
    );

    const pending = await treasuryPool.getTreasuryPendingData();

    expect(pending.hasPending).toBe(true);
    expect(pending.pendingKind).toEqual(1n);
    expectAddress(pending.pendingOldAddress!, gasPool.address);
    expectAddress(pending.pendingNewAddress!, newGasPool.address);

    await treasuryPool.sendConfirmRequest(
      owner.getSender(),
      {
        value: toNano('0.05'),
        queryId: 34n,
      }
    );

    const data = await treasuryPool.getTreasuryPoolData();
    const afterPending = await treasuryPool.getTreasuryPendingData();

    expectAddress(data.gasPoolAddress, newGasPool.address);
    expect(afterPending.hasPending).toBe(false);
  });

  it('should reject address request from non-manager', async () => {
    const treasuryPool = await deployPool();

    await ignoreFailure(
      treasuryPool.sendReplaceAddressRequest(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          oldAddress: gasPool.address,
          newAddress: newGasPool.address,
          queryId: 35n,
        }
      )
    );

    const pending = await treasuryPool.getTreasuryPendingData();
    const data = await treasuryPool.getTreasuryPoolData();

    expect(pending.hasPending).toBe(false);
    expectAddress(data.gasPoolAddress, gasPool.address);
  });
});