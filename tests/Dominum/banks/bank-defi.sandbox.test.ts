/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { BankDefi } from '../../../wrappers/Dominum/banks/BankDefi';

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

describe('BankDefi', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let wallet: SandboxContract<TreasuryContract>;
  let defiFoundation: SandboxContract<TreasuryContract>;
  let marketMaker: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let futureDefiTool: SandboxContract<TreasuryContract>;

  let bankDefiCode: Cell;

  beforeAll(async () => {
    bankDefiCode = await compile(DOM_COMPILE.bankDefi);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    wallet = await blockchain.treasury('wallet');
    defiFoundation = await blockchain.treasury('defi-foundation');
    marketMaker = await blockchain.treasury('market-maker');
    outsider = await blockchain.treasury('outsider');
    futureDefiTool = await blockchain.treasury('future-defi-tool');
  });

  async function deployBank() {
    const bankDefi = blockchain.openContract(
      BankDefi.createFromConfig(
        {
          ownerAddress: owner.address,
          walletAddress: wallet.address,
          defiFoundationAddress: defiFoundation.address,
          marketMakerAddress: marketMaker.address,
        },
        bankDefiCode
      )
    );

    await bankDefi.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return bankDefi;
  }

  it('should expose initial DeFi bank data', async () => {
    const bankDefi = await deployBank();
    const data = await bankDefi.getDefiBankData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.walletAddress, wallet.address);
    expectAddress(data.defiFoundationAddress, defiFoundation.address);
    expectAddress(data.marketMakerAddress, marketMaker.address);

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

  it('should allow only configured DeFi targets', async () => {
    const bankDefi = await deployBank();

    expect(
      await bankDefi.isAddressAllowed(defiFoundation.address)
    ).toBe(true);

    expect(
      await bankDefi.isAddressAllowed(marketMaker.address)
    ).toBe(true);

    expect(
      await bankDefi.isAddressAllowed(outsider.address)
    ).toBe(false);
  });

  it('should add and remove future DeFi targets through dynamic whitelist', async () => {
    const bankDefi = await deployBank();

    await bankDefi.sendAddWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: futureDefiTool.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    let data = await bankDefi.getDefiBankData();

    expect(data.whitelistCount).toEqual(
      DOM_STATE.oneCount
    );

    expect(
      await bankDefi.isAddressWhitelisted(futureDefiTool.address)
    ).toBe(true);

    expect(
      await bankDefi.isAddressAllowed(futureDefiTool.address)
    ).toBe(true);

    await bankDefi.sendRemoveWhitelist(
      owner.getSender(),
      {
        value: DOM_VALUE.config,
        address: futureDefiTool.address,
        queryId: DOM_QUERY.bankCommand,
      }
    );

    data = await bankDefi.getDefiBankData();

    expect(data.whitelistCount).toEqual(
      DOM_STATE.zeroCount
    );

    expect(
      await bankDefi.isAddressAllowed(futureDefiTool.address)
    ).toBe(false);
  });

  it('should reject whitelist changes from non-owner', async () => {
    const bankDefi = await deployBank();

    await ignoreFailure(
      bankDefi.sendAddWhitelist(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          address: futureDefiTool.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    const data = await bankDefi.getDefiBankData();

    expect(data.whitelistCount).toEqual(
      DOM_STATE.zeroCount
    );
  });
});
