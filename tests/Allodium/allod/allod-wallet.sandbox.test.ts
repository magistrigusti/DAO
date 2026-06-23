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

import { AllodWallet } from '../../../wrappers/Allodium/allod/AllodWallet';
import {
  AllodGasPool,
} from '../../../wrappers/Allodium/pools/AllodGasPool';
import {
  ALLODIUM_COMPILE,
  ALLODIUM_CONTRACT,
  ALLODIUM_FIXTURE,
  ALLODIUM_QUERY,
  ALLODIUM_STATE,
  ALLODIUM_VALUE,
} from '../_helpers/allodium-test-values';
import { expectAddress } from '../../Dominum/core/dom-test-utils';

describe('AllodWallet', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let receiver: SandboxContract<TreasuryContract>;
  let master: SandboxContract<TreasuryContract>;
  let authority: SandboxContract<TreasuryContract>;

  let walletCode: Cell;
  let gasPoolCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(ALLODIUM_COMPILE.wallet);
    gasPoolCode = await compile(ALLODIUM_COMPILE.allodGasPool);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    receiver = await blockchain.treasury('receiver');
    master = await blockchain.treasury('master');
    authority = await blockchain.treasury('authority');
  });

  function createWallet(
    gasPoolAddress: TreasuryContract['address'],
    ownerAddress = owner.address
  ) {
    return AllodWallet.createFromConfig(
      {
        balance: ALLODIUM_STATE.emptyBalance,
        ownerAddress,
        masterAddress: master.address,
        gasPoolAddress,
        jettonWalletCode: walletCode,
      },
      walletCode
    );
  }

  it('should receive and transfer ALLOD with TON tax', async () => {
    const gasPool = blockchain.openContract(
      AllodGasPool.createFromConfig(
        {
          authorityAddress: authority.address,
          masterAddress: master.address,
          jettonWalletCode: walletCode,
          masterConfigured: true,
          transferFeeAllod:
            ALLODIUM_CONTRACT.defaultAllodTransferFee,
        },
        gasPoolCode
      )
    );

    await gasPool.sendDeploy(
      authority.getSender(),
      ALLODIUM_VALUE.deployGasPool
    );

    const ownerWallet = blockchain.openContract(
      createWallet(gasPool.address)
    );

    await ownerWallet.sendDeploy(
      owner.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    await ownerWallet.sendInternalTransfer(
      master.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.walletInitialBalance,
        fromOwner: master.address,
        responseDestination: owner.address,
        queryId: ALLODIUM_QUERY.walletFund,
      }
    );

    let data = await ownerWallet.getWalletData();
    const protocol = await ownerWallet.getProtocolData();

    expectAddress(data.ownerAddress, owner.address);
    expect(data.jettonWalletCode.equals(walletCode)).toBe(true);
    expectAddress(protocol.gasPoolAddress, gasPool.address);

    expect(data.balance).toEqual(
      ALLODIUM_FIXTURE.walletInitialBalance
    );

    await ownerWallet.sendProtocolTransfer(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.transferWithTax,
        amount: ALLODIUM_FIXTURE.walletTransferAmount,
        toOwner: receiver.address,
        paidFeeAllod: ALLODIUM_CONTRACT.defaultAllodTransferFee,
        responseDestination: owner.address,
        queryId: ALLODIUM_QUERY.walletTransfer,
      }
    );

    data = await ownerWallet.getWalletData();

    expect(data.balance).toEqual(
      ALLODIUM_FIXTURE.walletInitialBalance -
        ALLODIUM_FIXTURE.walletTransferAmount -
        ALLODIUM_CONTRACT.defaultAllodTransferFee
    );

    const pending = await ownerWallet.getPendingTransfer(
      ALLODIUM_QUERY.walletTransfer
    );

    expect(pending.found).toBe(false);

    const receiverWallet = blockchain.openContract(
      createWallet(gasPool.address, receiver.address)
    );

    expect((await receiverWallet.getWalletData()).balance).toEqual(
      ALLODIUM_FIXTURE.walletTransferAmount
    );

    const poolWallet = blockchain.openContract(
      AllodWallet.createFromAddress(
        await gasPool.getPoolWalletAddress()
      )
    );

    expect((await poolWallet.getWalletData()).balance).toEqual(
      ALLODIUM_CONTRACT.defaultAllodTransferFee
    );
  });

  it('should follow TEP-74 and transfer ALLOD without protocol fee', async () => {
    const protocolAddress = authority.address;

    const ownerWallet = blockchain.openContract(
      createWallet(protocolAddress)
    );

    await ownerWallet.sendDeploy(
      owner.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    await ownerWallet.sendInternalTransfer(
      master.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.walletInitialBalance,
        fromOwner: master.address,
        responseDestination: owner.address,
        queryId: ALLODIUM_QUERY.walletFund,
      }
    );

    const receiverWallet = blockchain.openContract(
      createWallet(protocolAddress, receiver.address)
    );

    await ownerWallet.sendTransfer(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.deployGasPool,
        amount: ALLODIUM_FIXTURE.walletTransferAmount,
        destination: receiver.address,
        responseDestination: owner.address,
        customPayload: beginCell()
          .storeUint(1, 8)
          .endCell(),
        forwardTonAmount: 1n,
        forwardPayload: beginCell()
          .storeUint(0, 32)
          .storeStringTail('ALLOD TEP-74')
          .endCell(),
        queryId: ALLODIUM_QUERY.walletTransfer,
      }
    );

    const senderData = await ownerWallet.getWalletData();
    const receiverData = await receiverWallet.getWalletData();

    expect(senderData.balance).toEqual(
      ALLODIUM_FIXTURE.walletInitialBalance -
      ALLODIUM_FIXTURE.walletTransferAmount
    );
    expect(receiverData.balance).toEqual(
      ALLODIUM_FIXTURE.walletTransferAmount
    );
  });
});
