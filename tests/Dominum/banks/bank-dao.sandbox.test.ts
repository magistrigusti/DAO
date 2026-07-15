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

import {
  BankDao,
} from '../../../wrappers/Dominum/banks/BankDao';
import {
  OP_TRANSFER_NOTIFICATION,
} from '../../../wrappers/Dominum/core/op_code';

import {
  DOM_COMPILE,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('BankDao', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let placeholderWallet: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let replacementWallet: SandboxContract<TreasuryContract>;
  let member: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let bankDaoCode: Cell;

  beforeAll(async () => {
    bankDaoCode = await compile(DOM_COMPILE.bankDao);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    placeholderWallet =
      await blockchain.treasury('placeholder-wallet');
    wallet = await blockchain.treasury('wallet');
    replacementWallet =
      await blockchain.treasury('replacement-wallet');
    member = await blockchain.treasury('member');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployBank() {
    const bankDao = blockchain.openContract(
      BankDao.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: placeholderWallet.address,
          walletConfigured:
            DOM_STATE.walletNotConfigured,
        },
        bankDaoCode
      )
    );

    await bankDao.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return bankDao;
  }

  async function sendTransferNotification(
    sender: SandboxContract<TreasuryContract>,
    bankDao: SandboxContract<BankDao>,
    amount: bigint
  ) {
    const body = beginCell()
      .storeUint(OP_TRANSFER_NOTIFICATION, 32)
      .storeUint(DOM_QUERY.bankCommand, 64)
      .storeCoins(amount)
      .storeAddress(member.address)
      .endCell();

    await sender.send({
      to: bankDao.address,
      value: DOM_VALUE.config,
      body,
    });
  }

  it('should expose initial unconfigured bank data', async () => {
    const bankDao = await deployBank();
    const data = await bankDao.getBankData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(
      data.walletAddress,
      placeholderWallet.address
    );

    expect(data.walletConfigured).toBe(false);
    expect(data.whitelistCount).toEqual(
      DOM_STATE.zeroCount
    );
    expect(data.totalReceived).toEqual(
      DOM_STATE.zeroCoins
    );
    expect(data.totalSent).toEqual(
      DOM_STATE.zeroCoins
    );

    expect(
      await bankDao.isAddressWhitelisted(member.address)
    ).toBe(false);
  });

  it('should initialize wallet only from owner', async () => {
    const bankDao = await deployBank();

    await ignoreFailure(
      bankDao.sendInitWalletConfig(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          walletAddress: outsider.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    let data = await bankDao.getBankData();

    expect(data.walletConfigured).toBe(false);
    expectAddress(
      data.walletAddress,
      placeholderWallet.address
    );

    await bankDao.sendInitWalletConfig(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        walletAddress: wallet.address,
        queryId: DOM_QUERY.bankCommand + 1n,
      }
    );

    data = await bankDao.getBankData();

    expect(data.walletConfigured).toBe(true);
    expectAddress(data.walletAddress, wallet.address);
  });

  it('should reject wallet reinitialization', async () => {
    const bankDao = await deployBank();

    await bankDao.sendInitWalletConfig(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        walletAddress: wallet.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    await ignoreFailure(
      bankDao.sendInitWalletConfig(
        owner.getSender(),
        {
          value: DOM_VALUE.config,
          walletAddress: replacementWallet.address,
          queryId: DOM_QUERY.bankCommand + 1n,
        }
      )
    );

    const data = await bankDao.getBankData();

    expect(data.walletConfigured).toBe(true);
    expectAddress(data.walletAddress, wallet.address);
  });

  it('should accept DOM only after wallet configuration', async () => {
    const bankDao = await deployBank();
    const amount = DOM_FIXTURE.walletSmallTransferAmount;

    // Stored placeholder must not work before initialization.
    await ignoreFailure(
      sendTransferNotification(
        placeholderWallet,
        bankDao,
        amount
      )
    );

    let data = await bankDao.getBankData();

    expect(data.totalReceived).toEqual(
      DOM_STATE.zeroCoins
    );

    await bankDao.sendInitWalletConfig(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        walletAddress: wallet.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    await sendTransferNotification(
      wallet,
      bankDao,
      amount
    );

    data = await bankDao.getBankData();

    expect(data.totalReceived).toEqual(amount);

    // Previous placeholder is no longer trusted.
    await ignoreFailure(
      sendTransferNotification(
        placeholderWallet,
        bankDao,
        amount
      )
    );

    data = await bankDao.getBankData();

    expect(data.totalReceived).toEqual(amount);
  });

  it('should add and remove whitelist address from owner', async () => {
    const bankDao = await deployBank();

    await bankDao.sendAddWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    expect(
      await bankDao.isAddressWhitelisted(member.address)
    ).toBe(true);

    let data = await bankDao.getBankData();

    expect(data.whitelistCount).toEqual(
      DOM_STATE.oneCount
    );

    await bankDao.sendRemoveWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand + 1n,
      }
    );

    expect(
      await bankDao.isAddressWhitelisted(member.address)
    ).toBe(false);

    data = await bankDao.getBankData();

    expect(data.whitelistCount).toEqual(
      DOM_STATE.zeroCount
    );
  });

  it('should reject whitelist changes from non-owner', async () => {
    const bankDao = await deployBank();

    await ignoreFailure(
      bankDao.sendAddWhitelist(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          address: member.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    expect(
      await bankDao.isAddressWhitelisted(member.address)
    ).toBe(false);
  });
});