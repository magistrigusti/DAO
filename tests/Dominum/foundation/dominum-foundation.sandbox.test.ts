/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { DominumFoundation } from '../../../wrappers/Dominum/foundation/DominumFoundation';

import {
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('DominumFoundation', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let member: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let dominumFoundationCode: Cell;

  beforeAll(async () => {
    dominumFoundationCode = await compile(
      'Dominum/foundation/DominumFoundation'
    );
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    wallet = await blockchain.treasury('wallet');
    member = await blockchain.treasury('member');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployFoundation() {
    const dominumFoundation = blockchain.openContract(
      DominumFoundation.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: wallet.address,
        },
        dominumFoundationCode
      )
    );

    await dominumFoundation.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return dominumFoundation;
  }

  it('should expose initial foundation data', async () => {
    const dominumFoundation = await deployFoundation();
    const data = await dominumFoundation.getFoundationData();

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
    const dominumFoundation = await deployFoundation();

    await dominumFoundation.sendAddWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    expect(
      await dominumFoundation.isAddressWhitelisted(member.address)
    ).toBe(true);

    await dominumFoundation.sendRemoveWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: member.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    expect(
      await dominumFoundation.isAddressWhitelisted(member.address)
    ).toBe(false);
  });

  it('should reject whitelist changes from non-owner', async () => {
    const dominumFoundation = await deployFoundation();

    await ignoreFailure(
      dominumFoundation.sendAddWhitelist(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          address: member.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    expect(
      await dominumFoundation.isAddressWhitelisted(member.address)
    ).toBe(false);
  });
});