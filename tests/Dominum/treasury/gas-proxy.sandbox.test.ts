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

import { GasProxy } from '../../../wrappers/Dominum/treasury/GasProxy';

const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('GasProxy', () => {
  let blockchain: Blockchain;

  let admin: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let newPool: SandboxContract<TreasuryContract>;
  let anotherPool: SandboxContract<TreasuryContract>;
  let fakeMaster: SandboxContract<TreasuryContract>;

  let gasProxyCode: Cell;
  let walletCode: Cell;

  beforeAll(async () => {
    gasProxyCode = await compile(GAS_PROXY);
    walletCode = await compile(DOM_WALLET);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    admin = await blockchain.treasury('admin');
    outsider = await blockchain.treasury('outsider');
    newPool = await blockchain.treasury('new-pool');
    anotherPool = await blockchain.treasury('another-pool');
    fakeMaster = await blockchain.treasury('fake-master');
  });

  function openProxy() {
    return blockchain.openContract(
      GasProxy.createFromConfig(
        {
          adminAddress: admin.address,
          realGasPoolAddress: admin.address,
        },
        gasProxyCode
      )
    );
  }

  it('should initialize wallet config only once', async () => {
    const gasProxy = openProxy();

    await gasProxy.sendDeploy(
      admin.getSender(),
      toNano('0.1')
    );

    await gasProxy.sendSetWalletConfig(
      admin.getSender(),
      {
        value: toNano('0.05'),
        masterAddress: fakeMaster.address,
        jettonWalletCode: walletCode,
        queryId: 1n,
      }
    );

    await ignoreFailure(
      gasProxy.sendSetWalletConfig(
        admin.getSender(),
        {
          value: toNano('0.05'),
          masterAddress: newPool.address,
          jettonWalletCode: walletCode,
          queryId: 2n,
        }
      )
    );

    const walletConfig = await gasProxy.getWalletConfig();

    expect(walletConfig.walletConfigReady).toBe(true);
    expect(walletConfig.masterAddress?.toString()).toEqual(fakeMaster.address.toString());
  });

  it('should switch real gas pool only after timelock', async () => {
    const gasProxy = openProxy();

    await gasProxy.sendDeploy(
      admin.getSender(),
      toNano('0.1')
    );

    const baseNow = (blockchain.now ?? Math.floor(Date.now() / 1000)) + 1;

    blockchain.now = baseNow;

    await gasProxy.sendRequestChangePool(
      admin.getSender(),
      {
        value: toNano('0.05'),
        newGasPoolAddress: newPool.address,
        queryId: 3n,
      }
    );

    await ignoreFailure(
      gasProxy.sendConfirmChangePool(
        admin.getSender(),
        {
          value: toNano('0.05'),
          queryId: 4n,
        }
      )
    );

    const beforeUnlock = await gasProxy.getProxyData();
    const pendingBeforeUnlock = await gasProxy.getPendingChange();

    expect(beforeUnlock.realGasPoolAddress.toString()).toEqual(admin.address.toString());
    expect(pendingBeforeUnlock.hasPending).toBe(true);

    blockchain.now = baseNow + 61;

    await gasProxy.sendConfirmChangePool(
      admin.getSender(),
      {
        value: toNano('0.05'),
        queryId: 5n,
      }
    );

    const afterUnlock = await gasProxy.getProxyData();
    const pendingAfterUnlock = await gasProxy.getPendingChange();

    expect(afterUnlock.realGasPoolAddress.toString()).toEqual(newPool.address.toString());
    expect(pendingAfterUnlock.hasPending).toBe(false);
  });

  it('should cancel pending pool change', async () => {
    const gasProxy = openProxy();

    await gasProxy.sendDeploy(
      admin.getSender(),
      toNano('0.1')
    );

    blockchain.now = (blockchain.now ?? Math.floor(Date.now() / 1000)) + 1;

    await gasProxy.sendRequestChangePool(
      admin.getSender(),
      {
        value: toNano('0.05'),
        newGasPoolAddress: newPool.address,
        queryId: 6n,
      }
    );

    await gasProxy.sendCancelChangePool(
      admin.getSender(),
      {
        value: toNano('0.05'),
        queryId: 7n,
      }
    );

    const proxyData = await gasProxy.getProxyData();
    const pendingData = await gasProxy.getPendingChange();

    expect(proxyData.realGasPoolAddress.toString()).toEqual(admin.address.toString());
    expect(pendingData.hasPending).toBe(false);
    expect(pendingData.pendingAddress).toBeNull();
  });

  it('should ignore wallet config from non-admin', async () => {
    const gasProxy = openProxy();

    await gasProxy.sendDeploy(
      admin.getSender(),
      toNano('0.1')
    );

    await ignoreFailure(
      gasProxy.sendSetWalletConfig(
        outsider.getSender(),
        {
          value: toNano('0.05'),
          masterAddress: anotherPool.address,
          jettonWalletCode: walletCode,
          queryId: 8n,
        }
      )
    );

    const walletConfig = await gasProxy.getWalletConfig();

    expect(walletConfig.walletConfigReady).toBe(false);
    expect(walletConfig.masterAddress).toBeNull();
  });
});