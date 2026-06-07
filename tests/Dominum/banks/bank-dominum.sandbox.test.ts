/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { BankDominum } from '../../../wrappers/Dominum/banks/BankDominum';

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

describe('BankDominum', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let gasPool: SandboxContract<TreasuryContract>;
  let newGasPool: SandboxContract<TreasuryContract>;
  let domWallet: SandboxContract<TreasuryContract>;

  let bankDominumCode: Cell;

  beforeAll(async () => {
    bankDominumCode = await compile(DOM_COMPILE.bankDominum);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    gasPool = await blockchain.treasury('gas-pool');
    newGasPool = await blockchain.treasury('new-gas-pool');
    domWallet = await blockchain.treasury('dom-wallet');
  });

  async function deployBank() {
    const bankDominum = blockchain.openContract(
      BankDominum.createFromConfig(
        {
          ownerAddress: owner.address,
          gasPoolAddress: gasPool.address,
          domWalletAddress: domWallet.address,
        },
        bankDominumCode
      )
    );

    await bankDominum.sendDeploy(
      owner.getSender(),
      DOM_VALUE.deploySmall
    );

    return bankDominum;
  }

  it('should expose initial Dominum bank data', async () => {
    const bankDominum = await deployBank();
    const data = await bankDominum.getBankDominumData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.gasPoolAddress, gasPool.address);
    expectAddress(data.domWalletAddress, domWallet.address);

    expect(data.tonBalance >= DOM_STATE.zeroCoins).toBe(true);
  });

  it('should keep gas pool address unchanged for unsupported update command', async () => {
    const bankDominum = await deployBank();

    await ignoreFailure(
      bankDominum.sendUpdateGasPool(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          newGasPoolAddress: newGasPool.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    let data = await bankDominum.getBankDominumData();

    expectAddress(data.gasPoolAddress, gasPool.address);

    await ignoreFailure(
      bankDominum.sendUpdateGasPool(
        owner.getSender(),
        {
          value: DOM_VALUE.config,
          newGasPoolAddress: newGasPool.address,
          queryId: DOM_QUERY.bankCommand,
        }
      )
    );

    data = await bankDominum.getBankDominumData();

    expectAddress(data.gasPoolAddress, gasPool.address);
  });
});
