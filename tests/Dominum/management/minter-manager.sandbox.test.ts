/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  beginCell,
  Cell,
} from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { MinterManager } from '../../../wrappers/Dominum/management/MinterManager';

import {
  DOM_COMPILE,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('MinterManager', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let oldMinter: SandboxContract<TreasuryContract>;
  let newMinter: SandboxContract<TreasuryContract>;
  let giverManager: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let giver1: SandboxContract<TreasuryContract>;
  let giver2: SandboxContract<TreasuryContract>;
  let giver3: SandboxContract<TreasuryContract>;
  let giver4: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;
  let minterManagerCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    masterCode = await compile(DOM_COMPILE.master);
    minterManagerCode = await compile(DOM_COMPILE.minterManager);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    oldMinter = await blockchain.treasury('old-minter');
    newMinter = await blockchain.treasury('new-minter');
    giverManager = await blockchain.treasury('giver-manager');
    gasPool = await blockchain.treasury('gas-pool');
    giver1 = await blockchain.treasury('giver-1');
    giver2 = await blockchain.treasury('giver-2');
    giver3 = await blockchain.treasury('giver-3');
    giver4 = await blockchain.treasury('giver-4');
  });

  async function deployFlow() {
    const minterManager = blockchain.openContract(
      MinterManager.createFromConfig(
        {
          ownerAddress: owner.address,
        },
        minterManagerCode
      )
    );

    await minterManager.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    const domMaster = blockchain.openContract(
      DomMaster.createFromConfig(
        {
          totalSupply: DOM_STATE.emptySupply,
          ownerAddress: owner.address,
          lastMintTime: DOM_STATE.noLastMintTime,
          isStarted: DOM_STATE.notStarted,

          gasPoolAddress: gasPool.address,

          minterAddress: oldMinter.address,
          minterManagerAddress: minterManager.address,
          giverManagerAddress: giverManager.address,

          giverAllodiumAddress: giver1.address,
          giverDefiAddress: giver2.address,
          giverDaoAddress: giver3.address,
          giverDominumAddress: giver4.address,

          content: beginCell().endCell(),
          jettonWalletCode: walletCode,
        },
        masterCode
      )
    );

    await domMaster.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return {
      minterManager,
      domMaster,
    };
  }

  it('should expose owner address', async () => {
    const { minterManager } = await deployFlow();

    const managerOwner =
      await minterManager.getMinterManagerData();

    expectAddress(managerOwner, owner.address);
  });

  it('should replace minter through DomMaster from owner', async () => {
    const {
      minterManager,
      domMaster,
    } = await deployFlow();

    await minterManager.sendReplaceMinter(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        oldMinterAddress: oldMinter.address,
        newMinterAddress: newMinter.address,
        queryId: DOM_QUERY.replaceMinter,
      }
    );

    const masterData =
      await domMaster.getMasterData();

    expectAddress(
      masterData.minterAddress,
      newMinter.address
    );
  });

  it('should reject replace minter from non-owner', async () => {
    const {
      minterManager,
      domMaster,
    } = await deployFlow();

    await ignoreFailure(
      minterManager.sendReplaceMinter(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          masterAddress: domMaster.address,
          oldMinterAddress: oldMinter.address,
          newMinterAddress: newMinter.address,
          queryId: DOM_QUERY.replaceMinterRejected,
        }
      )
    );

    const masterData =
      await domMaster.getMasterData();

    expectAddress(
      masterData.minterAddress,
      oldMinter.address
    );
  });
});
