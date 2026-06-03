/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
  calculateDefaultDomFee,
} from '../_helpers/dom-test-constants';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('GasPool', () => {
  let blockchain: Blockchain;

  let treasuryPool: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let owner: SandboxContract<TreasuryContract>;
  let receiver: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let gasPoolCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    gasPoolCode = await compile(DOM_COMPILE.gasPool);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    treasuryPool = await blockchain.treasury('treasury-pool');
    master = await blockchain.treasury('master');
    owner = await blockchain.treasury('owner');
    receiver = await blockchain.treasury('receiver');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployGasPool(configured: boolean) {
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
      treasuryPool.getSender(),
      DOM_VALUE.deployGasPool
    );

    return gasPool;
  }

  it('should expose initial state', async () => {
    const gasPool = await deployGasPool(
      DOM_STATE.masterNotConfigured
    );

    const data = await gasPool.getGasPoolData();

    expectAddress(data.treasuryPoolAddress, treasuryPool.address);
    expect(data.masterConfigured).toBe(false);
    expect(data.taxMultiplier).toEqual(
      DOM_CONTRACT.taxMultiplier
    );
  });

  it('should initialize master only from treasury pool', async () => {
    const gasPool = await deployGasPool(
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

    await gasPool.sendInitMasterConfig(
      treasuryPool.getSender(),
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

  it('should execute wallet transfer and collect DOM fee', async () => {
    const gasPool = await deployGasPool(true);

    const senderWallet = blockchain.openContract(
      DomWallet.createFromConfig(
        {
          balance: DOM_FIXTURE.walletInitialBalance,
          ownerAddress: owner.address,
          masterAddress: master.address,
          gasPoolAddress: gasPool.address,
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
        maxFeeDom: DOM_CONTRACT.giverMaxFeeDom,
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
  });
});