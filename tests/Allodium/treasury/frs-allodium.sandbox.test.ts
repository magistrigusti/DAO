/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { FrsAllodium } from '../../../wrappers/Allodium/treasury/FrsAllodium';
import {
  ALLODIUM_COMPILE,
  ALLODIUM_FIXTURE,
  ALLODIUM_QUERY,
  ALLODIUM_STATE,
  ALLODIUM_VALUE,
  calculateAllodFromDom,
} from '../_helpers/allodium-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../../Dominum/core/dom-test-utils';

describe('FrsAllodium', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let domWallet: SandboxContract<TreasuryContract>;
  let allodMaster: SandboxContract<TreasuryContract>;
  let giverAllodium: SandboxContract<TreasuryContract>;
  let foundation: SandboxContract<TreasuryContract>;

  let frsCode: Cell;

  beforeAll(async () => {
    frsCode = await compile(ALLODIUM_COMPILE.frsAllodium);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    domWallet = await blockchain.treasury('dom-wallet');
    allodMaster = await blockchain.treasury('allod-master');
    giverAllodium = await blockchain.treasury('giver-allodium');
    foundation = await blockchain.treasury('foundation');
  });

  function openFrs(
    giverConfigured = true,
    walletConfigured = true
  ) {
    return blockchain.openContract(
      FrsAllodium.createFromConfig(
        {
          ownerAddress: owner.address,
          domWalletAddress: domWallet.address,
          allodMasterAddress: allodMaster.address,
          giverAllodiumAddress: giverAllodium.address,
          allodiumFoundationAddress: foundation.address,
          giverConfigured,
          walletConfigured,
          lockedDom: ALLODIUM_STATE.emptyLockedDom,
        },
        frsCode
      )
    );
  }

  it('should lock DOM from giver and unlock after ALLOD burn', async () => {
    const frs = openFrs();

    await frs.sendDeploy(
      owner.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    let data = await frs.getFrsData();

    expectAddress(data.ownerAddress, owner.address);
    expectAddress(data.domWalletAddress, domWallet.address);
    expect(data.giverConfigured).toBe(true);
    expect(data.walletConfigured).toBe(true);

    expect(data.lockedDom).toEqual(
      ALLODIUM_STATE.emptyLockedDom
    );

    await frs.sendDomTransferNotification(
      domWallet.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.lockedDomAmount,
        fromAddress: giverAllodium.address,
        queryId: ALLODIUM_QUERY.domLocked,
      }
    );

    expect(await frs.getLockedDom()).toEqual(
      ALLODIUM_FIXTURE.lockedDomAmount
    );

    expect(await frs.getMaxAllod()).toEqual(
      calculateAllodFromDom(ALLODIUM_FIXTURE.lockedDomAmount)
    );

    await frs.sendAllodBurned(
      allodMaster.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: calculateAllodFromDom(
          ALLODIUM_FIXTURE.lockedDomAmount
        ),
        queryId: ALLODIUM_QUERY.allodBurned,
      }
    );

    data = await frs.getFrsData();

    expect(data.lockedDom).toEqual(
      ALLODIUM_STATE.emptyLockedDom
    );
  });

  it('should initialize Giver exactly once from owner', async () => {
    const frs = openFrs(false);

    await frs.sendDeploy(owner.getSender(), ALLODIUM_VALUE.deploySmall);

    await ignoreFailure(
      frs.sendInitGiver(
        foundation.getSender(),
        {
          value: ALLODIUM_VALUE.config,
          giverAddress: giverAllodium.address,
          queryId: ALLODIUM_QUERY.rejected,
        }
      )
    );

    let data = await frs.getFrsData();
    expect(data.giverConfigured).toBe(false);

    await frs.sendInitGiver(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.config,
        giverAddress: giverAllodium.address,
        queryId: ALLODIUM_QUERY.domLocked,
      }
    );

    data = await frs.getFrsData();
    expect(data.giverConfigured).toBe(true);
    expectAddress(data.giverAllodiumAddress, giverAllodium.address);

    await ignoreFailure(
      frs.sendInitGiver(
        owner.getSender(),
        {
          value: ALLODIUM_VALUE.config,
          giverAddress: foundation.address,
          queryId: ALLODIUM_QUERY.allodBurned,
        }
      )
    );

    data = await frs.getFrsData();
    expectAddress(data.giverAllodiumAddress, giverAllodium.address);
  });

  it('should initialize DOM wallet exactly once from owner', async () => {
    const frs = openFrs(true, false);

    await frs.sendDeploy(owner.getSender(), ALLODIUM_VALUE.deploySmall);

    await ignoreFailure(
      frs.sendInitWallet(
        foundation.getSender(),
        {
          value: ALLODIUM_VALUE.config,
          walletAddress: domWallet.address,
          queryId: ALLODIUM_QUERY.rejected,
        }
      )
    );

    let data = await frs.getFrsData();
    expect(data.walletConfigured).toBe(false);

    await frs.sendInitWallet(
      owner.getSender(),
      {
        value: ALLODIUM_VALUE.config,
        walletAddress: domWallet.address,
        queryId: ALLODIUM_QUERY.domLocked,
      }
    );

    data = await frs.getFrsData();
    expect(data.walletConfigured).toBe(true);
    expectAddress(data.domWalletAddress, domWallet.address);

    await ignoreFailure(
      frs.sendInitWallet(
        owner.getSender(),
        {
          value: ALLODIUM_VALUE.config,
          walletAddress: foundation.address,
          queryId: ALLODIUM_QUERY.allodBurned,
        }
      )
    );

    data = await frs.getFrsData();
    expectAddress(data.domWalletAddress, domWallet.address);
  });
});
