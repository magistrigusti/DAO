/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import {
  AllodGasPool,
} from '../../../wrappers/Allodium/pools/AllodGasPool';
import {
  ALLODIUM_COMPILE,
  ALLODIUM_CONTRACT,
  ALLODIUM_QUERY,
  ALLODIUM_STATE,
  ALLODIUM_VALUE,
} from '../_helpers/allodium-test-values';

import {
  expectAddress,
  ignoreFailure,
} from '../../Dominum/core/dom-test-utils';

describe('AllodGasPool', () => {
  let blockchain: Blockchain;

  let authority: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let player: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let gasPoolCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(ALLODIUM_COMPILE.wallet);
    gasPoolCode = await compile(ALLODIUM_COMPILE.allodGasPool);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    authority = await blockchain.treasury('authority');
    master = await blockchain.treasury('allod-master');
    outsider = await blockchain.treasury('outsider');
    player = await blockchain.treasury('player');
  });

  async function deployGasPool(configured: boolean) {
    const gasPool = blockchain.openContract(
      AllodGasPool.createFromConfig(
        {
          authorityAddress: authority.address,
          masterAddress: configured ? master.address : authority.address,
          jettonWalletCode: walletCode,
          masterConfigured: configured,
          transferFeeAllod:
            ALLODIUM_CONTRACT.defaultAllodTransferFee,
        },
        gasPoolCode
      )
    );

    await gasPool.sendDeploy(
      authority.getSender(),
      ALLODIUM_VALUE.deployGasPool
    );

    return gasPool;
  }

  it('should expose initial state', async () => {
    const gasPool = await deployGasPool(
      ALLODIUM_STATE.masterNotConfigured
    );

    const data = await gasPool.getAllodGasPoolData();

    expectAddress(data.authorityAddress, authority.address);
    expect(data.masterConfigured).toBe(false);
    expect(data.transferFeeAllod).toEqual(
      ALLODIUM_CONTRACT.defaultAllodTransferFee
    );

    expect(await gasPool.getAllodTransferFee()).toEqual(
      ALLODIUM_CONTRACT.defaultAllodTransferFee
    );
  });

  it('should initialize master only from authority', async () => {
    const gasPool = await deployGasPool(
      ALLODIUM_STATE.masterNotConfigured
    );

    await ignoreFailure(
      gasPool.sendInitMasterConfig(
        outsider.getSender(),
        {
          value: ALLODIUM_VALUE.config,
          masterAddress: master.address,
          jettonWalletCode: walletCode,
          queryId: ALLODIUM_QUERY.allodGasInitMasterRejected,
        }
      )
    );

    let data = await gasPool.getAllodGasPoolData();

    expect(data.masterConfigured).toBe(false);

    await gasPool.sendInitMasterConfig(
      authority.getSender(),
      {
        value: ALLODIUM_VALUE.config,
        masterAddress: master.address,
        jettonWalletCode: walletCode,
        queryId: ALLODIUM_QUERY.allodGasInitMaster,
      }
    );

    data = await gasPool.getAllodGasPoolData();

    expect(data.masterConfigured).toBe(true);
    expectAddress(data.masterAddress, master.address);
  });

  it('should change fee only from authority', async () => {
    const gasPool = await deployGasPool(
      ALLODIUM_STATE.masterConfigured
    );

    await ignoreFailure(
      gasPool.sendChangeTransferFee(
        outsider.getSender(),
        {
          value: ALLODIUM_VALUE.service,
          newTransferFeeAllod:
            ALLODIUM_CONTRACT.changedAllodTransferFee,
          queryId: ALLODIUM_QUERY.allodGasChangeFeeRejected,
        }
      )
    );

    expect(await gasPool.getAllodTransferFee()).toEqual(
      ALLODIUM_CONTRACT.defaultAllodTransferFee
    );

    await gasPool.sendChangeTransferFee(
      authority.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        newTransferFeeAllod:
          ALLODIUM_CONTRACT.changedAllodTransferFee,
        queryId: ALLODIUM_QUERY.allodGasChangeFee,
      }
    );

    expect(await gasPool.getAllodTransferFee()).toEqual(
      ALLODIUM_CONTRACT.changedAllodTransferFee
    );
  });

  it('should calculate wallet addresses from configured master', async () => {
    const gasPool = await deployGasPool(
      ALLODIUM_STATE.masterConfigured
    );

    const playerWalletAddress =
      await gasPool.getWalletAddress(player.address);
    const poolWalletAddress =
      await gasPool.getPoolWalletAddress();

    expect(playerWalletAddress.toString()).not.toEqual(
      poolWalletAddress.toString()
    );
  });

  it('should accept TON top up only from authority', async () => {
    const gasPool = await deployGasPool(
      ALLODIUM_STATE.masterConfigured
    );

    await ignoreFailure(
      gasPool.sendTopUp(
        outsider.getSender(),
        {
          value: ALLODIUM_VALUE.service,
          queryId: ALLODIUM_QUERY.rejected,
        }
      )
    );

    await gasPool.sendTopUp(
      authority.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        queryId: ALLODIUM_QUERY.allodGasTopUp,
      }
    );

    const data = await gasPool.getAllodGasPoolData();

    expect(data.totalExecuted).toEqual(0n);
  });
});