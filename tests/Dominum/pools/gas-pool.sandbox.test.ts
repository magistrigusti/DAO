/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  Address,
  Cell,
} from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import { TreasuryPool } from '../../../wrappers/Dominum/treasury/TreasuryPool';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_FIXTURE,
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
  let receiver: SandboxContract<TreasuryContract>;
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
    receiver = await blockchain.treasury('receiver');
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

    return {
      gasPool,
      treasuryPool,
    };
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

  it('should execute Wallet → TreasuryPool → GasPool → TreasuryPool → Wallet', async () => {
    const { gasPool, treasuryPool } = await deployGasPool(true);

    const senderWallet = blockchain.openContract(
      DomWallet.createFromConfig(
        {
          balance: DOM_STATE.emptyBalance,
          ownerAddress: owner.address,
          masterAddress: master.address,
          treasuryPoolAddress: treasuryPool.address,
          jettonWalletCode: walletCode,
        },
        walletCode
      )
    );

    await senderWallet.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    expectAddress(
      senderWallet.address,
      await gasPool.getWalletAddress(owner.address)
    );

    await senderWallet.sendInternalTransfer(
      master.getSender(),
      {
        value: DOM_VALUE.deploySmall,
        amount: DOM_FIXTURE.walletInitialBalance,
        fromOwner: master.address,
        responseDestination: owner.address,
        queryId: DOM_QUERY.masterMint,
      }
    );

    await senderWallet.sendTransfer(
      owner.getSender(),
      {
        value: DOM_VALUE.deploySmall,
        jettonAmount: DOM_FIXTURE.walletSmallTransferAmount,
        toOwner: receiver.address,
        paidFeeDom: calculateDefaultDomFee(),
        responseDestination: owner.address,
        queryId: DOM_QUERY.gasTransfer,
      }
    );

    const receiverWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await gasPool.getWalletAddress(receiver.address)
      )
    );

    const poolWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await gasPool.getPoolWalletAddress()
      )
    );

    expect((await receiverWallet.getWalletData()).balance).toEqual(
      DOM_FIXTURE.walletSmallTransferAmount
    );

    expect((await poolWallet.getWalletData()).balance).toEqual(
      calculateDefaultDomFee()
    );

    const senderData = await senderWallet.getWalletData();
    const pending = await senderWallet.getPendingTransfer(
      DOM_QUERY.gasTransfer
    );
    const treasuryData = await treasuryPool.getTreasuryPoolData();

    expect(senderData.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance -
      DOM_FIXTURE.walletSmallTransferAmount -
      calculateDefaultDomFee()
    );
    expect(pending.found).toBe(false);
    expect(treasuryData.nextRouteId).toEqual(2n);
  });

  it('should restore Wallet balance when active GasPool message bounces', async () => {
    const missingGasPoolAddress = Address.parseRaw(
      `0:${'1'.repeat(64)}`
    );

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
          gasPoolAddress: missingGasPoolAddress,
        },
        treasuryPoolCode
      )
    );

    await treasuryPool.sendDeploy(
      treasuryOwner.getSender(),
      DOM_VALUE.deployTreasuryPool
    );

    const senderWallet = blockchain.openContract(
      DomWallet.createFromConfig(
        {
          balance: DOM_FIXTURE.walletInitialBalance,
          ownerAddress: owner.address,
          masterAddress: master.address,
          treasuryPoolAddress: treasuryPool.address,
          jettonWalletCode: walletCode,
        },
        walletCode
      )
    );

    await senderWallet.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    await senderWallet.sendTransfer(
      owner.getSender(),
      {
        value: DOM_VALUE.deploySmall,
        jettonAmount: DOM_FIXTURE.walletSmallTransferAmount,
        toOwner: receiver.address,
        paidFeeDom: calculateDefaultDomFee(),
        responseDestination: owner.address,
        queryId: DOM_QUERY.gasTransfer,
      }
    );

    const senderData = await senderWallet.getWalletData();
    const pending = await senderWallet.getPendingTransfer(
      DOM_QUERY.gasTransfer
    );

    expect(senderData.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance
    );
    expect(pending.found).toBe(false);
  });
});
