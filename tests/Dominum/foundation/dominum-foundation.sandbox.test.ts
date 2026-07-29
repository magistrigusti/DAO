/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Address, Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import {
  DominumFoundation,
} from '../../../wrappers/Dominum/foundation/DominumFoundation';

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

  async function deployFoundation(walletConfigured = true) {
    const dominumFoundation = blockchain.openContract(
      DominumFoundation.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: walletConfigured
            ? wallet.address
            : outsider.address,
          walletConfigured,
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
    expect(data.walletConfigured).toBe(true);

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

    const otherWorkchainMember = new Address(-1, member.address.hash);

    await ignoreFailure(
      dominumFoundation.sendRemoveWhitelist(
        owner.getSender(),
        {
          value: DOM_VALUE.config,
          address: otherWorkchainMember,
          queryId: DOM_QUERY.bankCommand,
        }
      )
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

  it('should initialize DOM wallet once from owner', async () => {
    const dominumFoundation = await deployFoundation(false);

    await ignoreFailure(
      dominumFoundation.sendInitWallet(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          walletAddress: wallet.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    let data = await dominumFoundation.getFoundationData();
    expect(data.walletConfigured).toBe(false);
    expectAddress(data.walletAddress, outsider.address);

    await dominumFoundation.sendInitWallet(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        walletAddress: wallet.address,
        queryId: DOM_QUERY.bankCommand + 1n,
      }
    );

    data = await dominumFoundation.getFoundationData();
    expect(data.walletConfigured).toBe(true);
    expectAddress(data.walletAddress, wallet.address);

    await ignoreFailure(
      dominumFoundation.sendInitWallet(
        owner.getSender(),
        {
          value: DOM_VALUE.config,
          walletAddress: outsider.address,
          queryId: DOM_QUERY.bankCommand + 2n,
        }
      )
    );

    data = await dominumFoundation.getFoundationData();
    expectAddress(data.walletAddress, wallet.address);
  });
});
