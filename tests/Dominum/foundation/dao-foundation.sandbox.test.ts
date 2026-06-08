/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DaoFoundation } from '../../../wrappers/Dominum/foundation/DaoFoundation';

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

describe('DaoFoundation', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let member: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let daoFoundationCode: Cell;

  beforeAll(async () => {
    daoFoundationCode = await compile(DOM_COMPILE.daoFoundation);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    wallet = await blockchain.treasury('wallet');
    member = await blockchain.treasury('member');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployFoundation() {
    const daoFoundation = blockchain.openContract(
      DaoFoundation.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: wallet.address,
        },
        daoFoundationCode
      )
    );

    await daoFoundation.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return daoFoundation;
  }

  it('should expose initial foundation data', async () => {
    const daoFoundation = await deployFoundation();
    const data = await daoFoundation.getFoundationData();

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
  });

  it('should add and remove whitelist address from owner', async () => {
    const daoFoundation = await deployFoundation();

    await daoFoundation.sendAddWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    expect(
      await daoFoundation.isAddressWhitelisted(member.address)
    ).toBe(true);

    await daoFoundation.sendRemoveWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    expect(
      await daoFoundation.isAddressWhitelisted(member.address)
    ).toBe(false);
  });

  it('should reject whitelist changes from non-owner', async () => {
    const daoFoundation = await deployFoundation();

    await ignoreFailure(
      daoFoundation.sendAddWhitelist(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          address: member.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    expect(
      await daoFoundation.isAddressWhitelisted(member.address)
    ).toBe(false);
  });
});
