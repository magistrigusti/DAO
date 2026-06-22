/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';

import {
  DOM_COMPILE,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
} from '../core/dom-test-utils';

describe('GiverAllodium', () => {
  let blockchain: Blockchain;

  let deployer: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let gasRouter: SandboxContract<TreasuryContract>;
  let frsAllodium: SandboxContract<TreasuryContract>;
  let allodiumFoundation: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let giverCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    giverCode = await compile(DOM_COMPILE.giverAllodium);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    deployer = await blockchain.treasury('deployer');
    master = await blockchain.treasury('master');
    gasRouter = await blockchain.treasury('gas-router');
    frsAllodium = await blockchain.treasury('frs-allodium');
    allodiumFoundation = await blockchain.treasury('allodium-foundation');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverAllodium.createFromConfig(
        {
          masterAddress: master.address,
          gasRouterAddress: gasRouter.address,
          jettonWalletCode: walletCode,
          frsAllodiumAddress: frsAllodium.address,
          allodiumFoundationAddress: allodiumFoundation.address,
        },
        giverCode
      )
    );
  }

  function expectedWalletAddress(
    giver: SandboxContract<GiverAllodium>
  ) {
    return DomWallet.createFromConfig(
      {
        balance: DOM_STATE.emptyBalance,
        ownerAddress: giver.address,
        masterAddress: master.address,
        gasRouterAddress: gasRouter.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    ).address;
  }

  it('should expose configured routing data and calculated wallet', async () => {
    const giver = openGiver();

    await giver.sendDeploy(
      deployer.getSender(),
      DOM_VALUE.deploySmall
    );

    const data = await giver.getGiverData();

    expectAddress(data.masterAddress, master.address);
    expectAddress(data.gasRouterAddress, gasRouter.address);
    expectAddress(data.walletAddress, expectedWalletAddress(giver));
    expectAddress(data.frsAllodiumAddress, frsAllodium.address);
    expectAddress(
      data.allodiumFoundationAddress,
      allodiumFoundation.address
    );
  });
});
