/// <reference types="jest" />

import { Address } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { compile } from '@ton/blueprint';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import {
  TreasuryPool,
} from '../../../wrappers/Dominum/treasury/TreasuryPool';
import {
  PROTOCOL_ACK,
  PROTOCOL_ROUTE_STATE,
} from '../../../wrappers/Dominum/core/constants';
import {
  DOM_COMPILE,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_VALUE,
  calculateDefaultDomFee,
} from '../_helpers/dom-test-values';
import {
  buildPendingTransferCell,
  buildRouteCell,
  buildSourceReceiptCell,
  createProtocolSettlementFixture,
  protocolDictionary,
} from '../_helpers/protocol-settlement.fixture';

async function createMissingLegFixture(ackMask: number) {
  const [walletCode, treasuryCode] = await Promise.all([
    compile(DOM_COMPILE.wallet),
    compile(DOM_COMPILE.treasuryPool),
  ]);
  const blockchain = await Blockchain.create();
  const owner = await blockchain.treasury('recovery-owner');
  const manager = await blockchain.treasury('recovery-manager');
  const master = await blockchain.treasury('recovery-master');
  const gasPool = await blockchain.treasury('recovery-gas');
  const source = await blockchain.treasury('recovery-source');
  const fromOwner = await blockchain.treasury('recovery-from');
  const toOwner = await blockchain.treasury('recovery-to');
  const caller = await blockchain.treasury('recovery-caller');
  const bankDao = await blockchain.treasury('recovery-bank-dao');
  const bankDefi = await blockchain.treasury('recovery-bank-defi');
  const bankDom = await blockchain.treasury('recovery-bank-dom');
  const routes = protocolDictionary();
  const amount = DOM_FIXTURE.walletSmallTransferAmount;
  const fee = calculateDefaultDomFee();
  routes.set(1n, buildRouteCell({
    sourceWallet: source.address,
    sourceQueryId: DOM_QUERY.gasTransfer,
    fromOwner: fromOwner.address,
    toOwner: toOwner.address,
    amount,
    fee,
    state: PROTOCOL_ROUTE_STATE.delivering,
    ackMask,
  }));
  const treasury = blockchain.openContract(
    TreasuryPool.createFromConfig(
      {
        ownerAddress: owner.address,
        treasuryManagerAddress: manager.address,
        bankDaoAddress: bankDao.address,
        bankDefiAddress: bankDefi.address,
        bankDominumAddress: bankDom.address,
        gasPoolAddress: gasPool.address,
        masterAddress: master.address,
        jettonWalletCode: walletCode,
        masterConfigured: true,
        nextRouteId: 2n,
        pendingRoutes: routes,
      },
      treasuryCode
    )
  );
  await treasury.sendDeploy(owner.getSender(), DOM_VALUE.mint);

  const walletFor = (walletOwner: Address) => {
    const initial = DomWallet.createFromConfig(
      {
        balance: 0n,
        ownerAddress: walletOwner,
        masterAddress: master.address,
        treasuryPoolAddress: treasury.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    );
    return blockchain.openContract(
      DomWallet.createFromAddress(initial.address)
    );
  };
  return {
    blockchain,
    treasury,
    caller,
    gasPool,
    toOwner,
    amount,
    fee,
    recipientWallet: walletFor(toOwner.address),
    feeWallet: walletFor(gasPool.address),
  };
}

async function retryMissingLeg(ackMask: number) {
  const fixture = await createMissingLegFixture(ackMask);
  await fixture.treasury.sendRetryRoute(
    fixture.caller.getSender(),
    { value: DOM_VALUE.mint, routeId: 1n }
  );
  return fixture;
}

async function createSourceWallet(opts: {
  pending: boolean;
  receipt: boolean;
  success: boolean;
}) {
  const walletCode = await compile(DOM_COMPILE.wallet);
  const blockchain = await Blockchain.create();
  const owner = await blockchain.treasury('source-owner');
  const master = await blockchain.treasury('source-master');
  const authority = await blockchain.treasury('source-authority');
  const routeId = 7n;
  const queryId = DOM_QUERY.gasTransfer;
  const totalSpend = DOM_FIXTURE.walletSmallTransferAmount +
    calculateDefaultDomFee();
  const pending = protocolDictionary();
  const receipts = protocolDictionary();
  if (opts.pending) {
    pending.set(queryId, buildPendingTransferCell({
      totalSpend,
      kind: 1,
      expectedSender: authority.address,
    }));
  }
  if (opts.receipt) {
    receipts.set(routeId, buildSourceReceiptCell({
      sourceQueryId: queryId,
      success: opts.success,
    }));
  }
  const startingBalance = DOM_FIXTURE.walletInitialBalance -
    totalSpend;
  const wallet = blockchain.openContract(
    DomWallet.createFromConfig(
      {
        balance: startingBalance,
        ownerAddress: owner.address,
        masterAddress: master.address,
        treasuryPoolAddress: authority.address,
        jettonWalletCode: walletCode,
        pendingTransfers: opts.pending ? pending : null,
        lastProtocolQueryId: queryId,
        sourceReceipts: opts.receipt ? receipts : null,
      },
      walletCode
    )
  );
  await wallet.sendDeploy(owner.getSender(), DOM_VALUE.deploySmall);
  return {
    wallet,
    authority,
    routeId,
    queryId,
    totalSpend,
    startingBalance,
  };
}

describe('DOM settlement recovery', () => {
  it('retries only the missing recipient delivery', async () => {
    const fixture = await retryMissingLeg(PROTOCOL_ACK.fee);
    const route = await fixture.treasury.getRoute(1n);
    expect((await fixture.recipientWallet.getWalletData()).balance)
      .toEqual(fixture.amount);
    expect(
      (await fixture.blockchain.getContract(
        fixture.feeWallet.address
      )).accountState
    ).toEqual({ type: 'uninit' });
    expect(route.ackMask).toEqual(BigInt(PROTOCOL_ACK.all));
    expect(route.state).toEqual(
      BigInt(PROTOCOL_ROUTE_STATE.waitCommit)
    );
  });

  it('retries only the missing fee delivery', async () => {
    const fixture = await retryMissingLeg(PROTOCOL_ACK.recipient);
    const route = await fixture.treasury.getRoute(1n);
    expect((await fixture.feeWallet.getWalletData()).balance)
      .toEqual(fixture.fee);
    expect(
      (await fixture.blockchain.getContract(
        fixture.recipientWallet.address
      )).accountState
    ).toEqual({ type: 'uninit' });
    expect(route.ackMask).toEqual(BigInt(PROTOCOL_ACK.all));
    expect(route.state).toEqual(
      BigInt(PROTOCOL_ROUTE_STATE.waitCommit)
    );
  });

  it('repeats a lost source ACK without changing balance', async () => {
    const fixture = await createSourceWallet({
      pending: false,
      receipt: true,
      success: true,
    });
    await fixture.wallet.sendProtocolSourceResult(
      fixture.authority.getSender(),
      {
        value: DOM_VALUE.deploySmall,
        routeId: fixture.routeId,
        sourceQueryId: fixture.queryId,
        success: true,
      }
    );
    expect((await fixture.wallet.getWalletData()).balance)
      .toEqual(fixture.startingBalance);
  });

  it('refunds a rejected route once across repeated results', async () => {
    const fixture = await createSourceWallet({
      pending: true,
      receipt: false,
      success: false,
    });
    const result = {
      value: DOM_VALUE.deploySmall,
      routeId: fixture.routeId,
      sourceQueryId: fixture.queryId,
      success: false,
    };
    await fixture.wallet.sendProtocolSourceResult(
      fixture.authority.getSender(),
      result
    );
    await fixture.wallet.sendProtocolSourceResult(
      fixture.authority.getSender(),
      result
    );
    expect((await fixture.wallet.getWalletData()).balance)
      .toEqual(DOM_FIXTURE.walletInitialBalance);
    expect(
      (await fixture.wallet.getPendingTransfer(fixture.queryId)).found
    ).toBe(false);
    expect(
      (await fixture.wallet.getSourceReceipt(fixture.routeId)).success
    ).toBe(false);
  });

  it('refunds once when the configured GasPool message bounces',
    async () => {
      const fixture = await createProtocolSettlementFixture(
        'rejecting'
      );
      await fixture.sourceWallet.sendProtocolTransfer(
        fixture.sourceOwner.getSender(),
        {
          value: DOM_VALUE.mint,
          jettonAmount: DOM_FIXTURE.walletSmallTransferAmount,
          toOwner: fixture.recipient.address,
          paidFeeDom: calculateDefaultDomFee(),
          queryId: DOM_QUERY.gasTransfer,
        }
      );
      const source = await fixture.sourceWallet.getWalletData();
      const pending = await fixture.sourceWallet.getPendingTransfer(
        DOM_QUERY.gasTransfer
      );
      const route = await fixture.treasuryPool.getRoute(1n);
      expect(source.balance).toEqual(
        DOM_FIXTURE.walletInitialBalance
      );
      expect(pending.found).toBe(false);
      expect(route.found).toBe(false);
      expect(
        (await fixture.blockchain.getContract(
          fixture.walletForOwner(fixture.recipient.address).address
        )).accountState
      ).toEqual({ type: 'uninit' });
    }
  );
});
