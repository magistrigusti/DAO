/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('DomWallet', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let receiver: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let walletCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(DOM_COMPILE.wallet);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    master = await blockchain.treasury('master');
    gasPool = await blockchain.treasury('gas-pool');
    receiver = await blockchain.treasury('receiver');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployWallet() {
    const wallet = blockchain.openContract(
      DomWallet.createFromConfig(
        {
          balance: DOM_FIXTURE.walletInitialBalance,
          ownerAddress: owner.address,
          masterAddress: master.address,
          gasPoolAddress: gasPool.address,
          jettonWalletCode: walletCode,
        },
        walletCode
      )
    );

    await wallet.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return wallet;
  }

  it('should expose wallet data', async () => {
    const wallet = await deployWallet();
    const data = await wallet.getWalletData();

    expect(data.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance
    );

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.masterAddress, master.address);
    expectAddress(data.gasPoolAddress, gasPool.address);
  });

  it('should debit owner transfer and create pending record', async () => {
    const wallet = await deployWallet();

    await wallet.sendTransfer(
      owner.getSender(),
      {
        value: DOM_VALUE.deploySmall,
        jettonAmount: DOM_FIXTURE.walletTransferAmount,
        toOwner: receiver.address,
        maxFeeDom: DOM_CONTRACT.giverMaxFeeDom,
        responseDestination: owner.address,
        queryId: DOM_QUERY.walletTransfer,
      }
    );

    const data = await wallet.getWalletData();
    const pending = await wallet.getPendingTransfer(
      DOM_QUERY.walletTransfer
    );

    expect(data.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance -
      DOM_FIXTURE.walletTransferAmount -
      DOM_CONTRACT.giverMaxFeeDom
    );

    expect(pending.found).toBe(true);
  });

  it('should reject transfer from non-owner', async () => {
    const wallet = await deployWallet();

    await ignoreFailure(
      wallet.sendTransfer(
        outsider.getSender(),
        {
          value: DOM_VALUE.deploySmall,
          jettonAmount: DOM_FIXTURE.walletTransferAmount,
          toOwner: receiver.address,
          maxFeeDom: DOM_CONTRACT.giverMaxFeeDom,
          responseDestination: outsider.address,
          queryId: DOM_QUERY.walletRejectedTransfer,
        }
      )
    );

    const data = await wallet.getWalletData();

    expect(data.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance
    );
  });
});
