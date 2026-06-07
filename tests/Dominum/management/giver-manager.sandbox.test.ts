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

describe('GiverManager', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
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

    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    gasPool = await blockchain.treasury('gas-pool');
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
          ownerAddress: owner.address,
        },
        giverManagerCode
      )
    );

    await giverManager.sendDeploy(
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
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return {
      giverManager,
      domMaster,
    };
  }

  it('should expose owner address', async () => {
    const { giverManager } = await deployFlow();
    const managerOwner = await giverManager.getManagerData();

    expectAddress(managerOwner, owner.address);
  });

  it('should replace giver through DomMaster from owner', async () => {
    const {
      giverManager,
      domMaster,
    } = await deployFlow();

    await giverManager.sendReplaceGiver(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        masterAddress: domMaster.address,
        oldGiverAddress: oldAllodiumGiver.address,
        newGiverAddress: newAllodiumGiver.address,
        queryId: DOM_QUERY.replaceGiverAllodium,
      }
    );

    const giversData = await domMaster.getGiversData();

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
});
