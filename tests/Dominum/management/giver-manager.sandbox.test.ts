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
import { GiverManager } from '../../../wrappers/Dominum/management/GiverManager';

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
import {
  GIVER_TARGET,
} from '../../../wrappers/Dominum/core/constants';

describe('GiverManager', () => {
  let blockchain: Blockchain;

  let managerOwner: SandboxContract<TreasuryContract>;
  let masterOwner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let treasuryPool: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<TreasuryContract>;
  let minterManager: SandboxContract<TreasuryContract>;
  let oldAllodiumGiver: SandboxContract<TreasuryContract>;
  let newAllodiumGiver: SandboxContract<TreasuryContract>;
  let defiGiver: SandboxContract<TreasuryContract>;
  let daoGiver: SandboxContract<TreasuryContract>;
  let dominumGiver: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;
  let giverManagerCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    masterCode = await compile(DOM_COMPILE.master);
    giverManagerCode = await compile(DOM_COMPILE.giverManager);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    managerOwner = await blockchain.treasury('manager-owner');
    masterOwner = await blockchain.treasury('master-owner');
    outsider = await blockchain.treasury('outsider');
    treasuryPool = await blockchain.treasury('treasury-pool');
    minter = await blockchain.treasury('minter');
    minterManager = await blockchain.treasury('minter-manager');
    oldAllodiumGiver = await blockchain.treasury('old-allodium-giver');
    newAllodiumGiver = await blockchain.treasury('new-allodium-giver');
    defiGiver = await blockchain.treasury('defi-giver');
    daoGiver = await blockchain.treasury('dao-giver');
    dominumGiver = await blockchain.treasury('dominum-giver');
  });

  async function deployFlow() {
    const giverManager = blockchain.openContract(
      GiverManager.createFromConfig(
        {
          ownerAddress: managerOwner.address,
        },
        giverManagerCode
      )
    );

    await giverManager.sendDeploy(
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
          treasuryPoolAddress: treasuryPool.address,
          minterAddress: minter.address,
          minterManagerAddress: minterManager.address,
          giverManagerAddress: giverManager.address,
          giverAllodiumAddress: oldAllodiumGiver.address,
          giverDefiAddress: defiGiver.address,
          giverDaoAddress: daoGiver.address,
          giverDominumAddress: dominumGiver.address,
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
      giverManager,
      domMaster,
    };
  }

  it('should expose owner address', async () => {
    const { giverManager } = await deployFlow();
    const storedManagerOwner = await giverManager.getManagerData();

    expectAddress(storedManagerOwner, managerOwner.address);
  });

  it('should replace giver through DomMaster from owner', async () => {
    const {
      giverManager,
      domMaster,
    } = await deployFlow();

    await giverManager.sendReplaceGiver(
      managerOwner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        targetKind: GIVER_TARGET.allodium,
        oldGiverAddress: oldAllodiumGiver.address,
        newGiverAddress: newAllodiumGiver.address,
        queryId: DOM_QUERY.replaceGiverAllodium,
      }
    );

    let giversData = await domMaster.getGiversData();

    expectAddress(
      giversData.giverAllodiumAddress,
      oldAllodiumGiver.address
    );

    await domMaster.sendConfirmMasterRequest(
      masterOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.replaceGiverAllodium + 1n,
      }
    );

    giversData = await domMaster.getGiversData();

    expectAddress(
      giversData.giverAllodiumAddress,
      newAllodiumGiver.address
    );

    expectAddress(giversData.giverDefiAddress, defiGiver.address);
    expectAddress(giversData.giverDaoAddress, daoGiver.address);
    expectAddress(giversData.giverDominumAddress, dominumGiver.address);
  });

  it('should reject replace giver from non-owner', async () => {
    const {
      giverManager,
      domMaster,
    } = await deployFlow();

    await ignoreFailure(
      giverManager.sendReplaceGiver(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          masterAddress: domMaster.address,
          targetKind: GIVER_TARGET.allodium,
          oldGiverAddress: oldAllodiumGiver.address,
          newGiverAddress: newAllodiumGiver.address,
          queryId: DOM_QUERY.replaceGiverRejected,
        }
      )
    );

    const giversData = await domMaster.getGiversData();

    expectAddress(
      giversData.giverAllodiumAddress,
      oldAllodiumGiver.address
    );
  });

  it('should replace GiverManager only after Master owner confirmation', async () => {
    const {
      giverManager,
      domMaster,
    } = await deployFlow();

    const newGiverManager =
      await blockchain.treasury('new-giver-manager');

    await giverManager.sendReplaceManager(
      managerOwner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        oldManagerAddress: giverManager.address,
        newManagerAddress: newGiverManager.address,
        queryId: DOM_QUERY.replaceGiverManager,
      }
    );

    let masterData = await domMaster.getMasterData();

    expectAddress(
      masterData.giverManagerAddress,
      giverManager.address
    );

    await domMaster.sendConfirmMasterRequest(
      masterOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.replaceGiverManager + 1n,
      }
    );

    masterData = await domMaster.getMasterData();

    expectAddress(
      masterData.giverManagerAddress,
      newGiverManager.address
    );
  });
});
