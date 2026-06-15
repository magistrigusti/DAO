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
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
  calculateShare,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('DomMaster', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let minterManager: SandboxContract<TreasuryContract>;
  let giverManager: SandboxContract<TreasuryContract>;
  let giverAllodium: SandboxContract<TreasuryContract>;
  let giverDefi: SandboxContract<TreasuryContract>;
  let giverDao: SandboxContract<TreasuryContract>;
  let giverDominum: SandboxContract<TreasuryContract>;

  let outsider: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let masterCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    masterCode = await compile(DOM_COMPILE.master);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    minter = await blockchain.treasury('minter');
    minterManager = await blockchain.treasury('minter-manager');
    giverManager = await blockchain.treasury('giver-manager');
    gasPool = await blockchain.treasury('gas-pool');

    giverAllodium = await blockchain.treasury('giver-allodium');
    giverDefi = await blockchain.treasury('giver-defi');
    giverDao = await blockchain.treasury('giver-dao');
    giverDominum = await blockchain.treasury('giver-dominum');

    outsider = await blockchain.treasury('outsider');
  });

  function openMaster() {
    return blockchain.openContract(
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
          giverAllodiumAddress: giverAllodium.address,
          giverDefiAddress: giverDefi.address,
          giverDaoAddress: giverDao.address,
          giverDominumAddress: giverDominum.address,

          content: beginCell().endCell(),
          jettonWalletCode: walletCode,
        },
        masterCode
      )
    );
  }

  it('should expose mint rules and initial state', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    const rules = await domMaster.getMintRules();
    const masterData = await domMaster.getMasterData();

    expect(rules.minMintAmount).toEqual(
      DOM_CONTRACT.minMintAmount
    );
    expect(rules.maxMintAmount).toEqual(
      DOM_CONTRACT.maxMintAmount
    );
    expect(rules.mintInterval).toEqual(
      DOM_CONTRACT.mintInterval
    );

    expect(masterData.isStarted).toBe(
      DOM_STATE.notStarted
    );
    expect(masterData.lastMintTime).toEqual(
      DOM_STATE.noLastMintTime
    );

    expectAddress(masterData.minterAddress, minter.address);
    expectAddress(masterData.giverManagerAddress, giverManager.address);
  });

  it('should mint only from active minter', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    await ignoreFailure(
      domMaster.sendMint(
        outsider.getSender(),
        {
          value: DOM_VALUE.mint,
          amount: DOM_FIXTURE.firstMintAmount,
          queryId: DOM_QUERY.directMintRejected,
        }
      )
    );

    let jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(
      DOM_STATE.emptySupply
    );

    await domMaster.sendMint(
      minter.getSender(),
      {
        value: DOM_VALUE.mint,
        amount: DOM_FIXTURE.firstMintAmount,
        queryId: DOM_QUERY.masterMint,
      }
    );

    jettonData = await domMaster.getJettonData();

    expect(jettonData.totalSupply).toEqual(
      DOM_FIXTURE.firstMintAmount
    );
  });

  it('should split minted supply between four givers', async () => {
    const domMaster = openMaster();

    await domMaster.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    await domMaster.sendMint(
      minter.getSender(),
      {
        value: DOM_VALUE.mint,
        amount: DOM_FIXTURE.firstMintAmount,
        queryId: DOM_QUERY.masterMint,
      }
    );

    const allodiumWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(giverAllodium.address)
      )
    );

    const defiWallet = blockchain.openContract(
      DomWallet.createFromAddress(
        await domMaster.getWalletAddress(giverDefi.address)
      )
    );

    expect((await allodiumWallet.getWalletData()).balance).toEqual(
      calculateShare(
        DOM_FIXTURE.firstMintAmount,
        DOM_CONTRACT.shareAllodium
      )
    );

    expect((await defiWallet.getWalletData()).balance).toEqual(
      calculateShare(
        DOM_FIXTURE.firstMintAmount,
        DOM_CONTRACT.shareDefi
      )
    );
  });
});
