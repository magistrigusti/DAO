/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';

import {
  DOM_COMPILE,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
} from '../core/dom-test-utils';

describe('GiverDominum', () => {
  let blockchain: Blockchain;

  let deployer: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let bankDominum: SandboxContract<TreasuryContract>;
  let dominumFoundation: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let giverCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    giverCode = await compile(DOM_COMPILE.giverDominum);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    deployer = await blockchain.treasury('deployer');
    master = await blockchain.treasury('master');
    gasPool = await blockchain.treasury('gas-pool');
    bankDominum = await blockchain.treasury('bank-dominum');
    dominumFoundation = await blockchain.treasury('dominum-foundation');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverDominum.createFromConfig(
        {
          masterAddress: master.address,
          gasPoolAddress: gasPool.address,
          jettonWalletCode: walletCode,
          bankDominumAddress: bankDominum.address,
          dominumFoundationAddress: dominumFoundation.address,
        },
        giverCode
      )
    );
  }

  function expectedWalletAddress(
    giver: SandboxContract<GiverDominum>
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
    expectAddress(data.bankDominumAddress, bankDominum.address);
    expectAddress(
      data.dominumFoundationAddress,
      dominumFoundation.address
    );
  });
});
