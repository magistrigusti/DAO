/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { AllodWallet } from '../../../wrappers/Allodium/allod/AllodWallet';
import {
  ALLODIUM_COMPILE,
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
  let foundation: SandboxContract<TreasuryContract>;

  let walletCode: Cell;

  beforeAll(async () => {
    walletCode = await compile(ALLODIUM_COMPILE.wallet);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    receiver = await blockchain.treasury('receiver');
    master = await blockchain.treasury('master');
    foundation = await blockchain.treasury('foundation');
  });

  function createWallet(ownerAddress = owner.address) {
    return AllodWallet.createFromConfig(
      {
        balance: ALLODIUM_STATE.emptyBalance,
        ownerAddress,
        masterAddress: master.address,
        foundationAddress: foundation.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    );
  }

  it('should receive and transfer ALLOD with TON tax', async () => {
    const ownerWallet = blockchain.openContract(createWallet());

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

    expectAddress(data.ownerAddress, owner.address);

    expect(data.balance).toEqual(
      ALLODIUM_FIXTURE.walletInitialBalance
    );

    await ownerWallet.sendTransfer(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.transferWithTax,
        amount: ALLODIUM_FIXTURE.walletTransferAmount,
        toOwner: receiver.address,
        responseDestination: owner.address,
        queryId: ALLODIUM_QUERY.walletTransfer,
      }
    );

    data = await ownerWallet.getWalletData();

    expect(data.balance).toEqual(
      ALLODIUM_FIXTURE.walletInitialBalance -
        ALLODIUM_FIXTURE.walletTransferAmount
    );

    const receiverWallet = blockchain.openContract(
      createWallet(receiver.address)
    );

    expect((await receiverWallet.getWalletData()).balance).toEqual(
      ALLODIUM_FIXTURE.walletTransferAmount
    );
  });
});