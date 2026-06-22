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

  let managerOwner: SandboxContract<TreasuryContract>;
  let masterOwner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let oldMinter: SandboxContract<TreasuryContract>;
  let newMinter: SandboxContract<TreasuryContract>;
  let giverManager: SandboxContract<TreasuryContract>;
  let gasRouter: SandboxContract<TreasuryContract>;
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

    managerOwner = await blockchain.treasury('manager-owner');
    masterOwner = await blockchain.treasury('master-owner');
    outsider = await blockchain.treasury('outsider');
    oldMinter = await blockchain.treasury('old-minter');
    newMinter = await blockchain.treasury('new-minter');
    giverManager = await blockchain.treasury('giver-manager');
    gasRouter = await blockchain.treasury('gas-router');
    giver1 = await blockchain.treasury('giver-1');
    giver2 = await blockchain.treasury('giver-2');
    giver3 = await blockchain.treasury('giver-3');
    giver4 = await blockchain.treasury('giver-4');
  });

  async function deployFlow() {
    const minterManager = blockchain.openContract(
      MinterManager.createFromConfig(
        {
          ownerAddress: managerOwner.address,
        },
        minterManagerCode
      )
    );

    await minterManager.sendDeploy(
      managerOwner.getSender(),
      DOM_VALUE.deploySmall
    );

    const domMaster = blockchain.openContract(
      DomMaster.createFromConfig(
        {
          totalSupply: DOM_STATE.emptySupply,
          ownerAddress: masterOwner.address,
          lastMintTime: DOM_STATE.noLastMintTime,
          isStarted: DOM_STATE.notStarted,

          gasRouterAddress: gasRouter.address,

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
      masterOwner.getSender(),
      DOM_VALUE.deploySmall
    );

    return {
      minterManager,
      domMaster,
    };
  }

  it('should expose owner address', async () => {
    const { minterManager } = await deployFlow();

    const storedManagerOwner =
      await minterManager.getMinterManagerData();

    expectAddress(storedManagerOwner, managerOwner.address);
  });

  it('should replace minter through DomMaster from owner', async () => {
    const {
      minterManager,
      domMaster,
    } = await deployFlow();

    await minterManager.sendReplaceMinter(
      managerOwner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        oldMinterAddress: oldMinter.address,
        newMinterAddress: newMinter.address,
        queryId: DOM_QUERY.replaceMinter,
      }
    );

    let masterData =
      await domMaster.getMasterData();

    expectAddress(
      masterData.minterAddress,
      oldMinter.address
    );

    const pending =
      await domMaster.getMasterPendingRequest();

    expect(pending.hasPending).toBe(true);

    await domMaster.sendConfirmMasterRequest(
      masterOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.replaceMinter + 1n,
      }
    );

    masterData = await domMaster.getMasterData();

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

  it('should replace MinterManager only after Master owner confirmation', async () => {
    const {
      minterManager,
      domMaster,
    } = await deployFlow();

    const newMinterManager =
      await blockchain.treasury('new-minter-manager');

    await minterManager.sendReplaceManager(
      managerOwner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        oldManagerAddress: minterManager.address,
        newManagerAddress: newMinterManager.address,
        queryId: DOM_QUERY.replaceMinterManager,
      }
    );

    let masterData = await domMaster.getMasterData();

    expectAddress(
      masterData.minterManagerAddress,
      minterManager.address
    );

    await domMaster.sendConfirmMasterRequest(
      masterOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.replaceMinterManager + 1n,
      }
    );

    masterData = await domMaster.getMasterData();

    expectAddress(
      masterData.minterManagerAddress,
      newMinterManager.address
    );
  });

  it('should keep current Minter when Master owner rejects request', async () => {
    const {
      minterManager,
      domMaster,
    } = await deployFlow();

    await minterManager.sendReplaceMinter(
      managerOwner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        oldMinterAddress: oldMinter.address,
        newMinterAddress: newMinter.address,
        queryId: DOM_QUERY.replaceMinter,
      }
    );

    await domMaster.sendRejectMasterRequest(
      masterOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.replaceMinter + 2n,
      }
    );

    const masterData = await domMaster.getMasterData();
    const pending = await domMaster.getMasterPendingRequest();

    expectAddress(
      masterData.minterAddress,
      oldMinter.address
    );
    expect(pending.hasPending).toBe(false);
  });
});
