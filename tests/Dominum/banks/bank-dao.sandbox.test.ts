/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { BankDao } from '../../../wrappers/Dominum/banks/BankDao';

import {
  DOM_COMPILE,
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
  let wallet: SandboxContract<TreasuryContract>;
  let member: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let bankDaoCode: Cell;

  beforeAll(async () => {
    bankDaoCode = await compile(DOM_COMPILE.bankDao);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    wallet = await blockchain.treasury('wallet');
    member = await blockchain.treasury('member');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployBank() {
    const bankDao = blockchain.openContract(
      BankDao.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: wallet.address,
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

  it('should expose initial bank data', async () => {
    const bankDao = await deployBank();
    const data = await bankDao.getBankData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.walletAddress, wallet.address);

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

    expect(data.whitelistCount).toEqual(1n);

    await bankDao.sendRemoveWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand,
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