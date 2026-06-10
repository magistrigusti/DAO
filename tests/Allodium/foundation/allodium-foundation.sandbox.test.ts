/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { AllodiumFoundation } from '../../../wrappers/Allodium/foundation/AllodiumFoundation';
import {
  ALLODIUM_COMPILE,
  ALLODIUM_FIXTURE,
  ALLODIUM_QUERY,
  ALLODIUM_STATE,
  ALLODIUM_VALUE,
} from '../_helpers/allodium-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../../Dominum/core/dom-test-utils';

describe('AllodiumFoundation', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let domWallet: SandboxContract<TreasuryContract>;
  let dao: SandboxContract<TreasuryContract>;
  let reserve: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let giverAllodium: SandboxContract<TreasuryContract>;

  let foundationCode: Cell;

  beforeAll(async () => {
    foundationCode = await compile(ALLODIUM_COMPILE.foundation);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    domWallet = await blockchain.treasury('dom-wallet');
    dao = await blockchain.treasury('dao');
    reserve = await blockchain.treasury('reserve');
    outsider = await blockchain.treasury('outsider');
    giverAllodium = await blockchain.treasury('giver-allodium');
  });

  function openFoundation() {
    return blockchain.openContract(
      AllodiumFoundation.createFromConfig(
        {
          ownerAddress: owner.address,
          domWalletAddress: domWallet.address,
          allodiumDaoAddress: dao.address,
          allodiumReserveAddress: reserve.address,
          totalReceived: ALLODIUM_STATE.emptyCounter,
          totalSent: ALLODIUM_STATE.emptyCounter,
        },
        foundationCode
      )
    );
  }

  it('should receive DOM and send only to allowed targets', async () => {
    const foundation = openFoundation();

    await foundation.sendDeploy(
      owner.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    const initialData = await foundation.getFoundationData();

    expectAddress(initialData.ownerAddress, owner.address);
    expectAddress(initialData.domWalletAddress, domWallet.address);

    expect(await foundation.isAddressAllowed(dao.address)).toBe(true);
    expect(await foundation.isAddressAllowed(reserve.address)).toBe(true);
    expect(await foundation.isAddressAllowed(outsider.address)).toBe(false);

    await foundation.sendDomTransferNotification(
      domWallet.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.lockedDomAmount,
        fromAddress: giverAllodium.address,
        queryId: ALLODIUM_QUERY.domLocked,
      }
    );

    let data = await foundation.getFoundationData();

    expect(data.totalReceived).toEqual(
      ALLODIUM_FIXTURE.lockedDomAmount
    );

    await foundation.sendWithdrawJettons(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.lockedDomAmount,
        toAddress: reserve.address,
        queryId: ALLODIUM_QUERY.withdraw,
      }
    );

    data = await foundation.getFoundationData();

    expect(data.totalSent).toEqual(
      ALLODIUM_FIXTURE.lockedDomAmount
    );

    await ignoreFailure(
      foundation.sendWithdrawJettons(
        owner.getSender(),
        {
          value: ALLODIUM_VALUE.service,
          amount: ALLODIUM_FIXTURE.lockedDomAmount,
          toAddress: outsider.address,
          queryId: ALLODIUM_QUERY.rejected,
        }
      )
    );

    data = await foundation.getFoundationData();

    expect(data.totalSent).toEqual(
      ALLODIUM_FIXTURE.lockedDomAmount
    );
  });
});