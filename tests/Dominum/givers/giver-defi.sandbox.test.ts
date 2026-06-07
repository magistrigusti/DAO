/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';

import {
  DOM_COMPILE,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
} from '../core/dom-test-utils';

describe('GiverDefi', () => {
  let blockchain: Blockchain;

  let deployer: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let market: SandboxContract<TreasuryContract>;
  let foundry: SandboxContract<TreasuryContract>;
  let defiTreasury: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let giverCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    giverCode = await compile(DOM_COMPILE.giverDefi);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    deployer = await blockchain.treasury('deployer');
    master = await blockchain.treasury('master');
    gasPool = await blockchain.treasury('gas-pool');
    market = await blockchain.treasury('market');
    foundry = await blockchain.treasury('foundry');
    defiTreasury = await blockchain.treasury('defi-treasury');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverDefi.createFromConfig(
        {
          masterAddress: master.address,
          gasPoolAddress: gasPool.address,
          jettonWalletCode: walletCode,
          marketAddress: market.address,
          foundryAddress: foundry.address,
          defiTreasuryAddress: defiTreasury.address,
        },
        giverCode
      )
    );
  }

  function expectedWalletAddress(
    giver: SandboxContract<GiverDefi>
  ) {
    return DomWallet.createFromConfig(
      {
        balance: DOM_STATE.emptyBalance,
        ownerAddress: giver.address,
        masterAddress: master.address,
        gasPoolAddress: gasPool.address,
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
    expectAddress(data.gasPoolAddress, gasPool.address);
    expectAddress(data.walletAddress, expectedWalletAddress(giver));
    expectAddress(data.marketAddress, market.address);
    expectAddress(data.foundryAddress, foundry.address);
    expectAddress(data.defiTreasuryAddress, defiTreasury.address);
  });
});
