/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GiverDao } from '../../../wrappers/Dominum/givers/GiverDao';

import {
  DOM_COMPILE,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
} from '../core/dom-test-utils';

describe('GiverDao', () => {
  let blockchain: Blockchain;

  let deployer: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let treasuryPool: SandboxContract<TreasuryContract>;
  let bankDao: SandboxContract<TreasuryContract>;
  let daoFoundation: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let giverCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
    giverCode = await compile(DOM_COMPILE.giverDao);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    deployer = await blockchain.treasury('deployer');
    master = await blockchain.treasury('master');
    treasuryPool = await blockchain.treasury('treasury-pool');
    bankDao = await blockchain.treasury('bank-dao');
    daoFoundation = await blockchain.treasury('dao-foundation');
  });

  function openGiver() {
    return blockchain.openContract(
      GiverDao.createFromConfig(
        {
          masterAddress: master.address,
          treasuryPoolAddress: treasuryPool.address,
          jettonWalletCode: walletCode,
          bankDaoAddress: bankDao.address,
          daoFoundationAddress: daoFoundation.address,
        },
        giverCode
      )
    );
  }

  function expectedWalletAddress(
    giver: SandboxContract<GiverDao>
  ) {
    return DomWallet.createFromConfig(
      {
        balance: DOM_STATE.emptyBalance,
        ownerAddress: giver.address,
        masterAddress: master.address,
        treasuryPoolAddress: treasuryPool.address,
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
    expectAddress(data.treasuryPoolAddress, treasuryPool.address);
    expectAddress(data.walletAddress, expectedWalletAddress(giver));
    expectAddress(data.bankDaoAddress, bankDao.address);
    expectAddress(data.daoFoundationAddress, daoFoundation.address);
  });
});
