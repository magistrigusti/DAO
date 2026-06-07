/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { TreasuryManager } from '../../../wrappers/Dominum/management/TreasuryManager';
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

describe('TreasuryManager', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let bankDao: SandboxContract<TreasuryContract>;
  let bankDefi: SandboxContract<TreasuryContract>;
  let bankDominum: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let newGasPool: SandboxContract<TreasuryContract>;

  let treasuryManagerCode: Cell;
  let treasuryPoolCode: Cell;

  beforeAll(async () => {
    treasuryManagerCode = await compile(DOM_COMPILE.treasuryManager);
    treasuryPoolCode = await compile(DOM_COMPILE.treasuryPool);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    wallet = await blockchain.treasury('wallet');
    bankDao = await blockchain.treasury('bank-dao');
    bankDefi = await blockchain.treasury('bank-defi');
    bankDominum = await blockchain.treasury('bank-dominum');
    gasPool = await blockchain.treasury('gas-pool');
    newGasPool = await blockchain.treasury('new-gas-pool');
  });

  async function deployFlow() {
    const treasuryManager = blockchain.openContract(
      TreasuryManager.createFromConfig(
        {
          ownerAddress: owner.address,
        },
        treasuryManagerCode
      )
    );

    await treasuryManager.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    const treasuryPool = blockchain.openContract(
      TreasuryPool.createFromConfig(
        {
          ownerAddress: owner.address,
          treasuryManagerAddress: treasuryManager.address,
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

    return {
      treasuryManager,
      treasuryPool,
    };
  }

  it('should expose owner address', async () => {
    const { treasuryManager } = await deployFlow();

    const managerOwner =
      await treasuryManager.getTreasuryManagerData();

    expectAddress(managerOwner, owner.address);
  });

  it('should forward address replacement request from owner', async () => {
    const {
      treasuryManager,
      treasuryPool,
    } = await deployFlow();

    await treasuryManager.sendReplaceTreasuryAddress(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        treasuryPoolAddress: treasuryPool.address,
        oldAddress: gasPool.address,
        newAddress: newGasPool.address,
        queryId: DOM_QUERY.treasuryAddressRequest,
      }
    );

    const pending =
      await treasuryPool.getTreasuryPendingData();

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
  });

  it('should reject address replacement from non-owner', async () => {
    const {
      treasuryManager,
      treasuryPool,
    } = await deployFlow();

    await ignoreFailure(
      treasuryManager.sendReplaceTreasuryAddress(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          treasuryPoolAddress: treasuryPool.address,
          oldAddress: gasPool.address,
          newAddress: newGasPool.address,
          queryId: DOM_QUERY.treasuryAddressRejected,
        }
      )
    );

    const pending =
      await treasuryPool.getTreasuryPendingData();

    expect(pending.hasPending).toBe(false);
  });
});
