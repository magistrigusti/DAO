/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import {
  TreasuryPool,
} from '../../../wrappers/Dominum/treasury/TreasuryPool';
import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
  calculateDefaultDomFee,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';
import {
  TREASURY_TARGET,
} from '../../../wrappers/Dominum/core/constants';

describe('GasPool', () => {
  let blockchain: Blockchain;
  let treasuryOwner: SandboxContract<TreasuryContract>;
  let treasuryManager: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let bankDao: SandboxContract<TreasuryContract>;
  let bankDefi: SandboxContract<TreasuryContract>;
  let bankDominum: SandboxContract<TreasuryContract>;
  let treasuryWallet: SandboxContract<TreasuryContract>;
  let walletCode: Cell;
  let gasPoolCode: Cell;
  let treasuryPoolCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    gasPoolCode = await compile(DOM_COMPILE.gasPool);
    treasuryPoolCode = await compile(DOM_COMPILE.treasuryPool);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    treasuryOwner = await blockchain.treasury('treasury-owner');
    treasuryManager = await blockchain.treasury('treasury-manager');
    master = await blockchain.treasury('master');
    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    bankDao = await blockchain.treasury('bank-dao');
    bankDefi = await blockchain.treasury('bank-defi');
    bankDominum = await blockchain.treasury('bank-dominum');
    treasuryWallet = await blockchain.treasury('treasury-wallet');
  });

  async function deployGasPool(configured: boolean) {
    const treasuryPool = blockchain.openContract(
      TreasuryPool.createFromConfig(
        {
          ownerAddress: treasuryOwner.address,
          treasuryManagerAddress: treasuryManager.address,
          jettonWalletAddress: treasuryWallet.address,
          walletConfigured: false,
          bankDaoAddress: bankDao.address,
          bankDefiAddress: bankDefi.address,
          bankDominumAddress: bankDominum.address,
          gasPoolAddress: outsider.address,
          masterAddress: master.address,
          jettonWalletCode: walletCode,
          masterConfigured: configured,
        },
        treasuryPoolCode
      )
    );
    await treasuryPool.sendDeploy(
      treasuryOwner.getSender(),
      DOM_VALUE.deployTreasuryPool
    );
    const gasPool = blockchain.openContract(
      GasPool.createFromConfig(
        {
          treasuryPoolAddress: treasuryPool.address,
          masterAddress: configured ? master.address : owner.address,
          jettonWalletCode: walletCode,
          masterConfigured: configured,
        },
        gasPoolCode
      )
    );
    await gasPool.sendDeploy(
      treasuryOwner.getSender(),
      DOM_VALUE.deployGasPool
    );
    await treasuryPool.sendReplaceAddressRequest(
      treasuryManager.getSender(),
      {
        value: DOM_VALUE.config,
        targetKind: TREASURY_TARGET.gasPool,
        oldAddress: outsider.address,
        newAddress: gasPool.address,
        queryId: DOM_QUERY.treasuryAddressRequest,
      }
    );
    await treasuryPool.sendConfirmRequest(
      treasuryOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.treasuryAddressConfirm,
      }
    );
    return { gasPool, treasuryPool };
  }

  it('should expose initial state', async () => {
    const { gasPool, treasuryPool } = await deployGasPool(
      DOM_STATE.masterNotConfigured
    );
    const data = await gasPool.getGasPoolData();
    expectAddress(data.treasuryPoolAddress, treasuryPool.address);
    expect(data.masterConfigured).toBe(false);
    expect(data.taxMultiplier).toEqual(
      DOM_CONTRACT.taxMultiplier
    );
    expect(await gasPool.getDomTransferFee()).toEqual(
      calculateDefaultDomFee()
    );
  });

  it('should initialize master only from treasury pool', async () => {
    const { gasPool, treasuryPool } = await deployGasPool(
      DOM_STATE.masterNotConfigured
    );
    await ignoreFailure(
      gasPool.sendInitMasterConfig(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          masterAddress: master.address,
          jettonWalletCode: walletCode,
          queryId: DOM_QUERY.gasInitMasterRejected,
        }
      )
    );
    let data = await gasPool.getGasPoolData();
    expect(data.masterConfigured).toBe(false);
    await treasuryPool.sendInitMasterConfig(
      treasuryOwner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: master.address,
        jettonWalletCode: walletCode,
        queryId: DOM_QUERY.gasInitMaster,
      }
    );
    data = await gasPool.getGasPoolData();
    expect(data.masterConfigured).toBe(true);
    expectAddress(data.masterAddress, master.address);
  });
});
