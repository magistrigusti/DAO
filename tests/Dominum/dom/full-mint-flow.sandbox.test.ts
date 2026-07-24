/// <reference types="jest" />

import {
  DOM_FIXTURE, calculateFirstMintGasPoolFee,
  calculateFirstMintSingleRecipientAmount,
} from '../_helpers/dom-test-values';

import {
  FULL_MINT_EXPECTED, createFullMintFlowFixture,
  executeFullMint, readFullMintResult,
} from '../_helpers/full-mint-flow.fixture';

describe('DOM full first mint flow', () => {
  it('configures contracts, mints DOM and distributes every share', async () => {
    const fixture = await createFullMintFlowFixture();
    await executeFullMint(fixture);
    const result = await readFullMintResult(fixture);

    expect(result.rolesConfigured).toBe(true);
    expect(result.gasConfigured).toBe(true);
    expect(result.treasuryConfigured).toBe(true);
    expect(result.masterStarted).toBe(true);

    expect(result.totalSupply).toEqual(DOM_FIXTURE.firstMintAmount);
    expect(result.recipientBalance)
      .toEqual(calculateFirstMintSingleRecipientAmount());
    expect(result.poolFeeBalance).toEqual(calculateFirstMintGasPoolFee());
    expect(result.totalReceivedDom).toEqual(calculateFirstMintGasPoolFee());
    expect(result.totalExecuted).toEqual(FULL_MINT_EXPECTED.totalExecutions);
    expect(result.nextRouteId).toEqual(FULL_MINT_EXPECTED.nextRouteId);

    expect(result.giverBalances).toEqual([
      FULL_MINT_EXPECTED.emptyBalance, FULL_MINT_EXPECTED.emptyBalance,
      FULL_MINT_EXPECTED.emptyBalance, FULL_MINT_EXPECTED.emptyBalance,
    ]);
  });
});