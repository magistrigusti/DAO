/// <reference types="jest" />

import type { BlockchainTransaction } from '@ton/sandbox';
import { Address } from '@ton/core';

import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import {
  OP_GAS_POOL_EXECUTE,
} from '../../../wrappers/Dominum/core/op_code';
import {
  createFullMintFlowFixture,
} from '../_helpers/full-mint-flow.fixture';
import {
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_VALUE,
  calculateFirstMintGasPoolFee,
  calculateFirstMintRecipientAmounts,
} from '../_helpers/dom-test-values';

type FullMintFlowFixture =
  Awaited<ReturnType<typeof createFullMintFlowFixture>>;

const FULL_MINT_EXPECTED = {
  totalExecutions: 9n,
  nextRouteId: 10n,
  emptyBalance: 0n,
} as const;

async function openOwnerWallet(
  fixture: FullMintFlowFixture,
  ownerAddress: Address
) {
  const walletAddress =
    await fixture.domMaster.getWalletAddress(ownerAddress);

  return fixture.blockchain.openContract(
    DomWallet.createFromAddress(walletAddress)
  );
}

async function readRecipientBalances(
  fixture: FullMintFlowFixture
) {
  const entries = Object.entries(fixture.recipients);
  const balances = await Promise.all(
    entries.map(async ([, owner]) => {
      const wallet = await openOwnerWallet(fixture, owner.address);
      return (await wallet.getWalletData()).balance;
    })
  );

  return Object.fromEntries(
    entries.map(([name], index) => [name, balances[index]])
  );
}

function expectSuccessfulGasPoolExecution(
  transaction: BlockchainTransaction
) {
  const description = transaction.description;

  expect(description.type).toBe('generic');

  if (description.type !== 'generic') {
    throw new Error('GasPool transaction is not generic');
  }

  expect(description.aborted).toBe(false);
  expect(description.computePhase.type).toBe('vm');

  if (description.computePhase.type === 'vm') {
    expect(description.computePhase.exitCode).toBe(0);
  }
}

describe('DOM full first mint flow', () => {
  it(
    'configures contracts, mints DOM and distributes every share',
    async () => {
    const fixture = await createFullMintFlowFixture();

    const mintResult = await fixture.minter.sendMint(
      fixture.minterOwner.getSender(),
      {
        value: DOM_VALUE.mint,
        amount: DOM_FIXTURE.firstMintAmount,
        queryId: DOM_QUERY.e2eMint,
      }
    );

    const gasPoolTransactions = mintResult.transactions.filter(
      (transaction) => {
        const info = transaction.inMessage?.info;
        return info?.type === 'internal' &&
          info.dest.equals(fixture.gasPool.address) &&
          transaction.inMessage!.body.beginParse().loadUintBig(32) ===
            OP_GAS_POOL_EXECUTE;
      }
    );

    expect(gasPoolTransactions)
      .toHaveLength(Number(FULL_MINT_EXPECTED.totalExecutions));
    gasPoolTransactions.forEach(expectSuccessfulGasPoolExecution);

    const poolWalletAddress =
      await fixture.gasPool.getPoolWalletAddress();

    const poolWallet = fixture.blockchain.openContract(
      DomWallet.createFromAddress(poolWalletAddress)
    );

    const giverWallets = await Promise.all([
      openOwnerWallet(fixture, fixture.giverAllodium.address),
      openOwnerWallet(fixture, fixture.giverDefi.address),
      openOwnerWallet(fixture, fixture.giverDao.address),
      openOwnerWallet(fixture, fixture.giverDominum.address),
    ]);

    const [
      jetton,
      master,
      gas,
      treasury,
      poolData,
      recipientBalances,
      givers,
    ] = await Promise.all([
      fixture.domMaster.getJettonData(),
      fixture.domMaster.getMasterData(),
      fixture.gasPool.getGasPoolData(),
      fixture.treasuryPool.getTreasuryPoolData(),
      poolWallet.getWalletData(),
      readRecipientBalances(fixture),
      fixture.domMaster.getGiversData(),
    ]);

    const giverBalances = await Promise.all(
      giverWallets.map(async (wallet) => {
        return (await wallet.getWalletData()).balance;
      })
    );

    const rolesConfigured =
      master.minterAddress.equals(fixture.minter.address) &&
      givers.giverAllodiumAddress.equals(fixture.giverAllodium.address) &&
      givers.giverDefiAddress.equals(fixture.giverDefi.address) &&
      givers.giverDaoAddress.equals(fixture.giverDao.address) &&
      givers.giverDominumAddress.equals(fixture.giverDominum.address);

    expect(rolesConfigured).toBe(true);
    expect(gas.masterConfigured).toBe(true);
    expect(treasury.walletConfigured).toBe(true);
    expect(master.isStarted).toBe(true);
    expect(jetton.totalSupply).toEqual(DOM_FIXTURE.firstMintAmount);
    expect(recipientBalances)
      .toEqual(calculateFirstMintRecipientAmounts());
    expect(poolData.balance).toEqual(calculateFirstMintGasPoolFee());
    expect(gas.totalReceivedDom)
      .toEqual(calculateFirstMintGasPoolFee());
    expect(gas.totalExecuted)
      .toEqual(FULL_MINT_EXPECTED.totalExecutions);
    expect(treasury.nextRouteId)
      .toEqual(FULL_MINT_EXPECTED.nextRouteId);
    expect(giverBalances).toEqual([
      FULL_MINT_EXPECTED.emptyBalance,
      FULL_MINT_EXPECTED.emptyBalance,
      FULL_MINT_EXPECTED.emptyBalance,
      FULL_MINT_EXPECTED.emptyBalance,
    ]);
    }
  );
});
