/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { FoundryLock } from '../../../wrappers/Dominum/invest/FoundryLock';

import {
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('FoundryLock', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let release: SandboxContract<TreasuryContract>;
  let newRelease: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let foundryLockCode: Cell;

  beforeAll(async () => {
    foundryLockCode = await compile('Dominum/invest/FoundryLock');
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    wallet = await blockchain.treasury('wallet');
    release = await blockchain.treasury('release');
    newRelease = await blockchain.treasury('new-release');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployFoundryLock() {
    const foundryLock = blockchain.openContract(
      FoundryLock.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: wallet.address,
          releaseAddress: release.address,
        },
        foundryLockCode
      )
    );

    await foundryLock.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return foundryLock;
  }

  it('should expose initial lock data', async () => {
    const foundryLock = await deployFoundryLock();
    const data = await foundryLock.getFoundryLockData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.walletAddress, wallet.address);
    expectAddress(data.releaseAddress, release.address);

    expect(data.totalReceived).toEqual(
      DOM_STATE.zeroCoins
    );

    expect(data.totalLocked).toEqual(
      DOM_STATE.zeroCoins
    );

    expect(data.totalUnlocked).toEqual(
      DOM_STATE.zeroCoins
    );

    expect(data.totalFeePaid).toEqual(
      DOM_STATE.zeroCoins
    );

    expect(data.totalReturnedFee).toEqual(
      DOM_STATE.zeroCoins
    );
  });

  it('should return empty bucket for a month with no deposits', async () => {
    const foundryLock = await deployFoundryLock();

    const bucket = await foundryLock.getLockedBucket(
      DOM_STATE.zeroCount
    );

    expect(bucket.found).toBe(false);
    expect(bucket.amount).toEqual(
      DOM_STATE.zeroCoins
    );
  });

  it('should update release address only from owner', async () => {
    const foundryLock = await deployFoundryLock();

    await ignoreFailure(
      foundryLock.sendSetRelease(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          releaseAddress: newRelease.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    let data = await foundryLock.getFoundryLockData();

    expectAddress(data.releaseAddress, release.address);

    await foundryLock.sendSetRelease(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        releaseAddress: newRelease.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    data = await foundryLock.getFoundryLockData();

    expectAddress(data.releaseAddress, newRelease.address);
  });
});