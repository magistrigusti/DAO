/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { MarketMaker } from '../../../wrappers/Dominum/defi/MarketMaker';

import {
  DOM_STATE,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
} from '../core/dom-test-utils';

describe('MarketMaker', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let defiBank: SandboxContract<TreasuryContract>;
  let defiFoundation: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let marketMakerCode: Cell;

  beforeAll(async () => {
    marketMakerCode = await compile('Dominum/defi/MarketMaker');
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    wallet = await blockchain.treasury('wallet');
    defiBank = await blockchain.treasury('defi-bank');
    defiFoundation = await blockchain.treasury('defi-foundation');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployMarketMaker() {
    const marketMaker = blockchain.openContract(
      MarketMaker.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: wallet.address,
          defiBankAddress: defiBank.address,
          defiFoundationAddress: defiFoundation.address,
        },
        marketMakerCode
      )
    );

    await marketMaker.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return marketMaker;
  }

  it('should expose initial market maker data', async () => {
    const marketMaker = await deployMarketMaker();
    const data = await marketMaker.getMarketData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.walletAddress, wallet.address);
    expectAddress(data.defiBankAddress, defiBank.address);
    expectAddress(data.defiFoundationAddress, defiFoundation.address);

    expect(data.totalReceived).toEqual(
      DOM_STATE.zeroCoins
    );

    expect(data.totalSent).toEqual(
      DOM_STATE.zeroCoins
    );
  });

  it('should allow only configured DeFi targets', async () => {
    const marketMaker = await deployMarketMaker();

    expect(
      await marketMaker.isAddressAllowed(defiBank.address)
    ).toBe(true);

    expect(
      await marketMaker.isAddressAllowed(defiFoundation.address)
    ).toBe(true);

    expect(
      await marketMaker.isAddressAllowed(outsider.address)
    ).toBe(false);
  });
});