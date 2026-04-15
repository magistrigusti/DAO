/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  Cell,
  toNano,
} from '@ton/core';
import { compile } from '@ton/blueprint';

import { GiverManager } from '../../../wrappers/Dominum/management/GiverManager';
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';

const GIVER_MANAGER = 'Dominum/givers/GiverManager' as const;
const GIVER_ALLODIUM = 'Dominum/givers/GiverAllodium' as const;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('GiverManager', () => {
  let blockchain: Blockchain;

  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let walletOwner: SandboxContract<TreasuryContract>;
  let target1: SandboxContract<TreasuryContract>;
  let target2: SandboxContract<TreasuryContract>;
  let newTarget1: SandboxContract<TreasuryContract>;
  let newTarget2: SandboxContract<TreasuryContract>;

  let giverManagerCode: Cell;
  let giverAllodiumCode: Cell;

  beforeAll(async () => {
    giverManagerCode = await compile(GIVER_MANAGER);
    giverAllodiumCode = await compile(GIVER_ALLODIUM);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    walletOwner = await blockchain.treasury('wallet-owner');
    target1 = await blockchain.treasury('target-1');
    target2 = await blockchain.treasury('target-2');
    newTarget1 = await blockchain.treasury('new-target-1');
    newTarget2 = await blockchain.treasury('new-target-2');
  });

  function openManager() {
    return blockchain.openContract(
      GiverManager.createFromConfig(
        {
          ownerAddress: owner.address,
        },
        giverManagerCode
      )
    );
  }

  function openAllodiumGiver(managerAddress: string) {
    return blockchain.openContract(
      GiverAllodium.createFromConfig(
        {
          managerAddress: owner.address.constructor.parse(managerAddress),
          walletAddress: null,
          frsAllodiumAddress: target1.address,
          allodiumFoundationAddress: target2.address,
        },
        giverAllodiumCode
      )
    );
  }

  it('should expose owner in getter', async () => {
    const giverManager = openManager();

    await giverManager.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    const managerOwner = await giverManager.getManagerData();

    expect(managerOwner.toString()).toEqual(owner.address.toString());
  });

  it('should set wallet in giver through manager', async () => {
    const giverManager = openManager();

    await giverManager.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    const giver = blockchain.openContract(
      GiverAllodium.createFromConfig(
        {
          managerAddress: giverManager.address,
          walletAddress: null,
          frsAllodiumAddress: target1.address,
          allodiumFoundationAddress: target2.address,
        },
        giverAllodiumCode
      )
    );

    await giver.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    await giverManager.sendSetWallet(
      owner.getSender(),
      {
        value: toNano('0.05'),
        giverAddress: giver.address,
        walletAddress: walletOwner.address,
        queryId: 1n,
      }
    );

    const giverData = await giver.getGiverData();

    expect(giverData.walletAddress?.toString()).toEqual(walletOwner.address.toString());
  });

  it('should change whitelist in giver through manager', async () => {
    const giverManager = openManager();

    await giverManager.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    const giver = blockchain.openContract(
      GiverAllodium.createFromConfig(
        {
          managerAddress: giverManager.address,
          walletAddress: null,
          frsAllodiumAddress: target1.address,
          allodiumFoundationAddress: target2.address,
        },
        giverAllodiumCode
      )
    );

    await giver.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    await giverManager.sendChangeWhitelist(
      owner.getSender(),
      {
        value: toNano('0.05'),
        giverAddress: giver.address,
        newAddress1: newTarget1.address,
        newAddress2: newTarget2.address,
        queryId: 2n,
      }
    );

    const giverData = await giver.getGiverData();

    expect(giverData.frsAllodiumAddress.toString()).toEqual(newTarget1.address.toString());
    expect(giverData.allodiumFoundationAddress.toString()).toEqual(newTarget2.address.toString());
  });

  it('should ignore manager commands from non-owner', async () => {
    const giverManager = openManager();

    await giverManager.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    const giver = blockchain.openContract(
      GiverAllodium.createFromConfig(
        {
          managerAddress: giverManager.address,
          walletAddress: null,
          frsAllodiumAddress: target1.address,
          allodiumFoundationAddress: target2.address,
        },
        giverAllodiumCode
      )
    );

    await giver.sendDeploy(
      owner.getSender(),
      toNano('0.05')
    );

    await ignoreFailure(
      giverManager.sendSetWallet(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          giverAddress: giver.address,
          walletAddress: walletOwner.address,
          queryId: 3n,
        }
      )
    );

    await ignoreFailure(
      giverManager.sendChangeWhitelist(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          giverAddress: giver.address,
          newAddress1: newTarget1.address,
          newAddress2: newTarget2.address,
          queryId: 4n,
        }
      )
    );

    const giverData = await giver.getGiverData();

    expect(giverData.walletAddress).toBeNull();
    expect(giverData.frsAllodiumAddress.toString()).toEqual(target1.address.toString());
    expect(giverData.allodiumFoundationAddress.toString()).toEqual(target2.address.toString());
  });
});