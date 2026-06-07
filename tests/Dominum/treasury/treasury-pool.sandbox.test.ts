/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { TreasuryPool } from '../../../wrappers/Dominum/treasury/TreasuryPool';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  expectOptionalAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('TreasuryPool', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let manager: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let bankDao: SandboxContract<TreasuryContract>;
  let bankDefi: SandboxContract<TreasuryContract>;
  let bankDominum: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let newGasPool: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let treasuryPoolCode: Cell;

  beforeAll(async () => {
    treasuryPoolCode = await compile(DOM_COMPILE.treasuryPool);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    manager = await blockchain.treasury('treasury-manager');
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
          treasuryManagerAddress: manager.address,
          jettonWalletAddress: wallet.address,
          walletConfigured: DOM_STATE.walletNotConfigured,
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
      DOM_VALUE.deployTreasuryPool
    );

    return treasuryPool;
  }

  it('should expose treasury data and allowed targets', async () => {
    const treasuryPool = await deployPool();
    const data = await treasuryPool.getTreasuryPoolData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.treasuryManagerAddress, manager.address);
    expectAddress(data.jettonWalletAddress, wallet.address);

    expect(data.walletConfigured).toBe(
      DOM_STATE.walletNotConfigured
    );

    expect(data.taxMultiplier).toEqual(
      DOM_CONTRACT.taxMultiplier
    );

    expect(await treasuryPool.isTreasuryTargetAllowed(bankDao.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(bankDefi.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(bankDominum.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(gasPool.address)).toBe(true);
    expect(await treasuryPool.isTreasuryTargetAllowed(outsider.address)).toBe(false);
  });

  it('should initialize wallet only from owner', async () => {
    const treasuryPool = await deployPool();

    await ignoreFailure(
      treasuryPool.sendInitTreasuryWalletConfig(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          jettonWalletAddress: outsider.address,
          queryId: DOM_QUERY.treasuryWalletInitRejected,
        }
      )
    );

    let data = await treasuryPool.getTreasuryPoolData();

    expect(data.walletConfigured).toBe(false);
    expectAddress(data.jettonWalletAddress, wallet.address);

    await treasuryPool.sendInitTreasuryWalletConfig(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        jettonWalletAddress: wallet.address,
        queryId: DOM_QUERY.treasuryWalletInit,
      }
    );

    data = await treasuryPool.getTreasuryPoolData();

    expect(data.walletConfigured).toBe(true);
    expectAddress(data.jettonWalletAddress, wallet.address);
  });

  it('should accept manager address request and owner confirmation', async () => {
    const treasuryPool = await deployPool();

    await treasuryPool.sendReplaceAddressRequest(
      manager.getSender(),
      {
        value: DOM_VALUE.config,
        oldAddress: gasPool.address,
        newAddress: newGasPool.address,
        queryId: DOM_QUERY.treasuryAddressRequest,
      }
    );

    const pending = await treasuryPool.getTreasuryPendingData();

    expect(pending.hasPending).toBe(true);
    expect(pending.pendingKind).toEqual(
      DOM_CONTRACT.pendingAddressKind
    );

    expectOptionalAddress(
      pending.pendingOldAddress,
      gasPool.address
    );

    expectOptionalAddress(
      pending.pendingNewAddress,
      newGasPool.address
    );

    await treasuryPool.sendConfirmRequest(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.treasuryAddressConfirm,
      }
    );

    const data = await treasuryPool.getTreasuryPoolData();

    expectAddress(data.gasPoolAddress, newGasPool.address);
  });
});
