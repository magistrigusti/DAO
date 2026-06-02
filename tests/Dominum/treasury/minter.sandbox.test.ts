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
import { Minter } from '../../../wrappers/Dominum/treasury/Minter';

import {
  DOM_COMPILE,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-constants';
import {
  expectAddress,
  ignoreFailure,
} from '../_helpers/dom-test-utils';

describe('Minter', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let minterManager: SandboxContract<TreasuryContract>;
  let giverManager: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let giver1: SandboxContract<TreasuryContract>;
  let giver2: SandboxContract<TreasuryContract>;
  let giver3: SandboxContract<TreasuryContract>;
  let giver4: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;
  let minterCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    masterCode = await compile(DOM_COMPILE.master);
    minterCode = await compile(DOM_COMPILE.minter);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    minterManager = await blockchain.treasury('minter-manager');
    giverManager = await blockchain.treasury('giver-manager');
    gasPool = await blockchain.treasury('gas-pool');
    giver1 = await blockchain.treasury('giver-1');
    giver2 = await blockchain.treasury('giver-2');
    giver3 = await blockchain.treasury('giver-3');
    giver4 = await blockchain.treasury('giver-4');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployFlow() {
    const domMaster = blockchain.openContract(
      DomMaster.createFromConfig(
        {
          totalSupply: DOM_STATE.emptySupply,
          ownerAddress: owner.address,
          lastMintTime: DOM_STATE.noLastMintTime,
          isStarted: DOM_STATE.notStarted,
          gasPoolAddress: gasPool.address,
          minterAddress: owner.address,
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

    const minter = blockchain.openContract(
      Minter.createFromConfig(
        {
          ownerAddress: owner.address,
          masterAddress: domMaster.address,
        },
        minterCode
      )
    );

    await minter.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    await domMaster.sendReplaceMinter(
      minterManager.getSender(),
      {
        value: DOM_VALUE.config,
        oldMinterAddress: owner.address,
        newMinterAddress: minter.address,
        queryId: DOM_QUERY.replaceMinter,
      }
    );

    return {
      domMaster,
      minter,
    };
  }

  it('should expose minter owner and master', async () => {
    const { domMaster, minter } = await deployFlow();
    const data = await minter.getMinterData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.masterAddress, domMaster.address);
  });

  it('should mint through connected DomMaster', async () => {
    const { domMaster, minter } = await deployFlow();

    await minter.sendMint(
      owner.getSender(),
      {
        value: DOM_VALUE.mint,
        amount: DOM_FIXTURE.firstMintAmount,
        queryId: DOM_QUERY.minterMint,
      }
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(
      DOM_FIXTURE.firstMintAmount
    );
  });

  it('should reject mint from non-owner', async () => {
    const { domMaster, minter } = await deployFlow();

    await ignoreFailure(
      minter.sendMint(
        outsider.getSender(),
        {
          value: DOM_VALUE.mint,
          amount: DOM_FIXTURE.firstMintAmount,
          queryId: DOM_QUERY.minterMintRejected,
        }
      )
    );

    const jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(
      DOM_STATE.emptySupply
    );
  });
});