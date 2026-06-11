/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { beginCell, Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { AllodMaster } from '../../../wrappers/Allodium/allod/AllodMaster';
import { AllodWallet } from '../../../wrappers/Allodium/allod/AllodWallet';
import {
  ALLODIUM_COMPILE,
  ALLODIUM_FIXTURE,
  ALLODIUM_QUERY,
  ALLODIUM_STATE,
  ALLODIUM_VALUE,
} from '../_helpers/allodium-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../../Dominum/core/dom-test-utils';

describe('AllodMaster', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let frs: SandboxContract<TreasuryContract>;
  let foundation: SandboxContract<TreasuryContract>;
  let player: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let masterCode: Cell;
  let walletCode: Cell;

  beforeAll(async () => {
    masterCode = await compile(ALLODIUM_COMPILE.master);
    walletCode = await compile(ALLODIUM_COMPILE.wallet);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    frs = await blockchain.treasury('frs');
    foundation = await blockchain.treasury('foundation');
    player = await blockchain.treasury('player');
    outsider = await blockchain.treasury('outsider');
  });

  function openMaster() {
    return blockchain.openContract(
      AllodMaster.createFromConfig(
        {
          totalSupply: ALLODIUM_STATE.emptySupply,
          ownerAddress: owner.address,
          frsAddress: frs.address,
          foundationAddress: foundation.address,
          mintAllowancePool: ALLODIUM_STATE.emptyAllowance,
          content: beginCell().endCell(),
          jettonWalletCode: walletCode,
        },
        masterCode
      )
    );
  }

  it('should expose master data and wallet address', async () => {
    const allodMaster = openMaster();

    await allodMaster.sendDeploy(
      owner.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    const data = await allodMaster.getMasterData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.frsAddress, frs.address);
    expectAddress(data.foundationAddress, foundation.address);

    expect(data.mintAllowancePool).toEqual(
      ALLODIUM_STATE.emptyAllowance
    );

    const expectedWallet = AllodWallet.createFromConfig(
      {
        balance: ALLODIUM_STATE.emptyBalance,
        ownerAddress: player.address,
        masterAddress: allodMaster.address,
        foundationAddress: foundation.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    );

    expectAddress(
      await allodMaster.getWalletAddress(player.address),
      expectedWallet.address
    );
  });

  it('should mint only within FRS allowance', async () => {
    const allodMaster = openMaster();

    await allodMaster.sendDeploy(
      owner.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    await ignoreFailure(
      allodMaster.sendIncreaseMintAllowance(
        outsider.getSender(),
        {
          value: ALLODIUM_VALUE.service,
          amount: ALLODIUM_FIXTURE.mintAllowance,
          queryId: ALLODIUM_QUERY.rejected,
        }
      )
    );

    let data = await allodMaster.getMasterData();

    expect(data.mintAllowancePool).toEqual(
      ALLODIUM_STATE.emptyAllowance
    );

    await allodMaster.sendIncreaseMintAllowance(
      frs.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.mintAllowance,
        queryId: ALLODIUM_QUERY.increaseAllowance,
      }
    );

    await allodMaster.sendMint(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.deployMedium,
        toOwner: player.address,
        amount: ALLODIUM_FIXTURE.mintAmount,
        queryId: ALLODIUM_QUERY.mint,
      }
    );

    data = await allodMaster.getMasterData();

    expect(data.totalSupply).toEqual(
      ALLODIUM_FIXTURE.mintAmount
    );

    const playerWallet = blockchain.openContract(
      AllodWallet.createFromAddress(
        await allodMaster.getWalletAddress(player.address)
      )
    );

    expect((await playerWallet.getWalletData()).balance).toEqual(
      ALLODIUM_FIXTURE.mintAmount
    );
  });
});