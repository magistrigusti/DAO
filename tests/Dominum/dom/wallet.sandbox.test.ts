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

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_STATE,
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
  let treasuryPool: SandboxContract<TreasuryContract>;
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
    treasuryPool = await blockchain.treasury('treasury-pool');
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
          treasuryPoolAddress: treasuryPool.address,
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
    const protocol = await wallet.getProtocolData();

    expect(data.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance
    );

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.masterAddress, master.address);
    expect(data.jettonWalletCode.equals(walletCode)).toBe(true);
    expectAddress(
      protocol.treasuryPoolAddress,
      treasuryPool.address
    );
  });

  it('should debit protocol transfer with fee and create pending record', async () => {
    const wallet = await deployWallet();

    await wallet.sendProtocolTransfer(
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
          amount: DOM_FIXTURE.walletTransferAmount,
          destination: receiver.address,
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

  it('should follow TEP-74 and debit only transfer amount', async () => {
    const wallet = blockchain.openContract(
      DomWallet.createFromConfig(
        {
          balance: DOM_STATE.emptyBalance,
          ownerAddress: owner.address,
          masterAddress: master.address,
          treasuryPoolAddress: treasuryPool.address,
          jettonWalletCode: walletCode,
        },
        walletCode
      )
    );

    await wallet.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    await wallet.sendInternalTransfer(
      master.getSender(),
      {
        value: DOM_VALUE.deploySmall,
        amount: DOM_FIXTURE.walletInitialBalance,
        fromOwner: master.address,
        responseDestination: owner.address,
        queryId: DOM_QUERY.masterMint,
      }
    );

    const receiverWallet = blockchain.openContract(
      DomWallet.createFromConfig(
        {
          balance: DOM_STATE.emptyBalance,
          ownerAddress: receiver.address,
          masterAddress: master.address,
          treasuryPoolAddress: treasuryPool.address,
          jettonWalletCode: walletCode,
        },
        walletCode
      )
    );

    await wallet.sendTransfer(
      owner.getSender(),
      {
        value: DOM_VALUE.deployGasPool,
        amount: DOM_FIXTURE.walletTransferAmount,
        destination: receiver.address,
        responseDestination: owner.address,
        customPayload: beginCell()
          .storeUint(1, 8)
          .endCell(),
        forwardTonAmount: 1n,
        forwardPayload: beginCell()
          .storeUint(0, 32)
          .storeStringTail('DOM TEP-74')
          .endCell(),
        queryId: DOM_QUERY.walletTransfer,
      }
    );

    const senderData = await wallet.getWalletData();
    const receiverData = await receiverWallet.getWalletData();
    const pending = await wallet.getPendingTransfer(
      DOM_QUERY.walletTransfer
    );

    expect(senderData.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance -
      DOM_FIXTURE.walletTransferAmount
    );
    expect(receiverData.balance).toEqual(
      DOM_FIXTURE.walletTransferAmount
    );
    expect(pending.found).toBe(false);
  });
});
