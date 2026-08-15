/// <reference types="jest" />

import { beginCell } from '@ton/core';
import {
  buildGasResponseBody,
  buildLegacyDeliveryBody,
} from '../../../wrappers/Dominum/treasury/TreasuryPoolMessages';
import {
  PROTOCOL_LEG,
  PROTOCOL_ROUTE_STATE,
} from '../../../wrappers/Dominum/core/constants';
import {
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_VALUE,
  calculateDefaultDomFee,
} from '../_helpers/dom-test-values';
import {
  createProtocolSettlementFixture,
  deployWalletWithAuthority,
} from '../_helpers/protocol-settlement.fixture';

describe('DOM two-phase settlement', () => {
  it('commits only after both wallet acknowledgements', async () => {
    const fixture = await createProtocolSettlementFixture();
    const amount = DOM_FIXTURE.walletSmallTransferAmount;
    const fee = calculateDefaultDomFee();
    await fixture.sourceWallet.sendProtocolTransfer(
      fixture.sourceOwner.getSender(),
      {
        value: DOM_VALUE.mint,
        jettonAmount: amount,
        toOwner: fixture.recipient.address,
        paidFeeDom: fee,
        queryId: DOM_QUERY.gasTransfer,
      }
    );
    const recipientWallet = fixture.walletForOwner(
      fixture.recipient.address
    );
    const feeWallet = fixture.walletForOwner(
      fixture.gasPool.address
    );
    const [recipient, pool, source, route, execution, gas] =
      await Promise.all([
        recipientWallet.getWalletData(),
        feeWallet.getWalletData(),
        fixture.sourceWallet.getWalletData(),
        fixture.treasuryPool.getRoute(1n),
        fixture.gasPool.getExecution(1n),
        fixture.gasPool.getGasPoolData(),
      ]);
    expect(recipient.balance).toEqual(amount);
    expect(pool.balance).toEqual(fee);
    expect(source.balance).toEqual(
      DOM_FIXTURE.walletInitialBalance - amount - fee
    );
    expect(route.found).toBe(false);
    expect(execution.found).toBe(false);
    expect(gas.totalReceivedDom).toEqual(fee);
    expect(gas.totalExecuted).toEqual(1n);
  });

  it('rejects legacy arbitrary delivery even from active GasPool', async () => {
    const fixture = await createProtocolSettlementFixture(false);
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
    const before = await fixture.treasuryPool.getRoute(1n);
    const legacyBody = buildLegacyDeliveryBody({
      queryId: 1n,
      walletAddress: fixture.outsider.address,
      walletStateInit: beginCell().endCell(),
      walletBody: beginCell().storeUint(1, 1).endCell(),
    });
    await fixture.treasuryPool.sendRaw(
      fixture.fakeGasPool.getSender(),
      { value: DOM_VALUE.deploySmall, body: legacyBody }
    );
    const after = await fixture.treasuryPool.getRoute(1n);
    expect(before.state).toEqual(
      BigInt(PROTOCOL_ROUTE_STATE.waitGas)
    );
    expect(after.state).toEqual(before.state);
    expect(after.ackMask).toEqual(0n);
    expect(after.found).toBe(true);
  });

  it('rejects unauthorized GasPool responses and acknowledgements',
    async () => {
      const fixture = await createProtocolSettlementFixture(false);
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
      await fixture.treasuryPool.sendRaw(
        fixture.outsider.getSender(),
        {
          value: DOM_VALUE.deploySmall,
          body: buildGasResponseBody({
            routeId: 1n,
            kind: 'ready',
          }),
        }
      );
      const route = await fixture.treasuryPool.getRoute(1n);
      expect(route.state).toEqual(
        BigInt(PROTOCOL_ROUTE_STATE.waitGas)
      );
      expect(route.ackMask).toEqual(0n);
    }
  );

  it('credits an exact delivery once and rejects mismatched replay',
    async () => {
      const fixture = await createProtocolSettlementFixture(false);
      const authority = await fixture.blockchain.treasury(
        'wallet-protocol-authority'
      );
      const walletOwner = await fixture.blockchain.treasury(
        'wallet-replay-owner'
      );
      const wallet = await deployWalletWithAuthority({
        blockchain: fixture.blockchain,
        walletCode: fixture.walletCode,
        authority,
        owner: walletOwner,
        master: fixture.master,
      });
      const delivery = {
        value: DOM_VALUE.deploySmall,
        routeId: 1n,
        leg: PROTOCOL_LEG.recipient,
        amount: DOM_FIXTURE.walletSmallTransferAmount,
        fromOwner: fixture.sourceOwner.address,
      };
      await wallet.sendProtocolDelivery(
        fixture.outsider.getSender(),
        delivery
      );
      expect((await wallet.getWalletData()).balance).toEqual(0n);
      await wallet.sendProtocolDelivery(authority.getSender(), delivery);
      await wallet.sendProtocolDelivery(authority.getSender(), delivery);
      expect((await wallet.getWalletData()).balance).toEqual(
        delivery.amount
      );
      await wallet.sendProtocolDelivery(
        authority.getSender(),
        { ...delivery, amount: delivery.amount + 1n }
      );
      const processed = await wallet.getProcessedDelivery(
        delivery.routeId,
        delivery.leg
      );
      expect(processed.amount).toEqual(delivery.amount);
      expect(processed.found).toBe(true);
      expect((await wallet.getWalletData()).balance).toEqual(
        delivery.amount
      );
    }
  );
});
