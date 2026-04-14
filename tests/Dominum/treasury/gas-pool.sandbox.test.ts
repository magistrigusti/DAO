/// <reference types="jest" />

import {
    Blockchain,
    SandboxContract,
    TreasuryContract,
  } from '@ton/sandbox';
  import {
    beginCell,
    Cell,
    toNano,
  } from '@ton/core';
  import { compile } from '@ton/blueprint';
  
  import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
  import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
  import { GasPool } from '../../../wrappers/Dominum/treasury/GasPool';
  import { GasProxy } from '../../../wrappers/Dominum/treasury/GasProxy';
  
  const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
  const DOM_WALLET = 'Dominum/dom/DomWallet' as const;
  const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
  const GAS_POOL = 'Dominum/treasury/GasPool' as const;
  
  async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
    try {
      await promise;
    } catch {}
  }
  
  describe('GasPool', () => {
    let blockchain: Blockchain;
  
    let admin: SandboxContract<TreasuryContract>;
    let sender: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;
    let treasuryOwner: SandboxContract<TreasuryContract>;
    let newTreasury: SandboxContract<TreasuryContract>;
    let dummyDefi: SandboxContract<TreasuryContract>;
    let dummyDao: SandboxContract<TreasuryContract>;
    let dummyDominum: SandboxContract<TreasuryContract>;
  
    let walletCode: Cell;
    let masterCode: Cell;
    let gasProxyCode: Cell;
    let gasPoolCode: Cell;
  
    beforeAll(async () => {
      walletCode = await compile(DOM_WALLET);
      masterCode = await compile(DOM_MASTER);
      gasProxyCode = await compile(GAS_PROXY);
      gasPoolCode = await compile(GAS_POOL);
    });
  
    beforeEach(async () => {
      blockchain = await Blockchain.create();
  
      admin = await blockchain.treasury('admin');
      sender = await blockchain.treasury('sender');
      receiver = await blockchain.treasury('receiver');
      treasuryOwner = await blockchain.treasury('treasury-owner');
      newTreasury = await blockchain.treasury('new-treasury');
      dummyDefi = await blockchain.treasury('dummy-defi');
      dummyDao = await blockchain.treasury('dummy-dao');
      dummyDominum = await blockchain.treasury('dummy-dominum');
    });
  
    async function deployTransferFlow() {
      const gasProxy = blockchain.openContract(
        GasProxy.createFromConfig(
          {
            adminAddress: admin.address,
            realGasPoolAddress: admin.address,
          },
          gasProxyCode
        )
      );
  
      const gasPool = blockchain.openContract(
        GasPool.createFromConfig(
          {
            adminAddress: admin.address,
            proxyAddress: gasProxy.address,
            domTreasuryAddress: treasuryOwner.address,
            domBalance: 0n,
            tonReserve: 0n,
          },
          gasPoolCode
        )
      );
  
      await gasProxy.sendDeploy(
        admin.getSender(),
        toNano('0.1')
      );
      await gasPool.sendDeploy(
        admin.getSender(),
        toNano('0.1')
      );
  
      const baseNow = (blockchain.now ?? Math.floor(Date.now() / 1000)) + 1;
  
      blockchain.now = baseNow;
  
      await gasProxy.sendRequestChangePool(
        admin.getSender(),
        {
          value: toNano('0.05'),
          newGasPoolAddress: gasPool.address,
          queryId: 1n,
        }
      );
  
      blockchain.now = baseNow + 61;
  
      await gasProxy.sendConfirmChangePool(
        admin.getSender(),
        {
          value: toNano('0.05'),
          queryId: 2n,
        }
      );
  
      const domMaster = blockchain.openContract(
        DomMaster.createFromConfig(
          {
            totalSupply: 0n,
            ownerAddress: admin.address,
            lastMintTime: 0n,
            isStarted: false,
            gasPoolAddress: gasProxy.address,
            giverAllodiumAddress: sender.address,
            giverDefiAddress: dummyDefi.address,
            giverDaoAddress: dummyDao.address,
            giverDominumAddress: dummyDominum.address,
            content: beginCell().endCell(),
            jettonWalletCode: walletCode,
          },
          masterCode
        )
      );
  
      await domMaster.sendDeploy(
        admin.getSender(),
        toNano('0.05')
      );
  
      await gasProxy.sendSetWalletConfig(
        admin.getSender(),
        {
          value: toNano('0.05'),
          masterAddress: domMaster.address,
          jettonWalletCode: walletCode,
          queryId: 3n,
        }
      );
  
      await domMaster.sendMint(
        admin.getSender(),
        {
          value: toNano('0.25'),
          amount: 1_000_000_000n,
          queryId: 4n,
        }
      );
  
      const senderWallet = blockchain.openContract(
        DomWallet.createFromAddress(
          await domMaster.getWalletAddress(sender.address)
        )
      );
  
      return {
        domMaster,
        gasProxy,
        gasPool,
        senderWallet,
      };
    }
  
    function openSimplePool() {
      return blockchain.openContract(
        GasPool.createFromConfig(
          {
            adminAddress: admin.address,
            proxyAddress: admin.address,
            domTreasuryAddress: treasuryOwner.address,
            domBalance: 0n,
            tonReserve: 0n,
          },
          gasPoolCode
        )
      );
    }
  
    it('should route wallet transfer through proxy and gas pool', async () => {
      const {
        domMaster,
        gasProxy,
        gasPool,
        senderWallet,
      } = await deployTransferFlow();
  
      await senderWallet.sendTransfer(
        sender.getSender(),
        {
          value: toNano('0.05'),
          jettonAmount: 100_000_000n,
          toOwner: receiver.address,
          queryId: 5n,
        }
      );
  
      const receiverWallet = blockchain.openContract(
        DomWallet.createFromAddress(
          await domMaster.getWalletAddress(receiver.address)
        )
      );
      const treasuryWallet = blockchain.openContract(
        DomWallet.createFromAddress(
          await domMaster.getWalletAddress(treasuryOwner.address)
        )
      );
  
      const proxyData = await gasProxy.getProxyData();
      const poolData = await gasPool.getPoolData();
      const senderData = await senderWallet.getWalletData();
      const receiverData = await receiverWallet.getWalletData();
      const treasuryData = await treasuryWallet.getWalletData();
  
      expect(proxyData.realGasPoolAddress.toString()).toEqual(gasPool.address.toString());
      expect(senderData.balance).toEqual(50_000_000n);
      expect(receiverData.balance).toEqual(100_000_000n);
      expect(treasuryData.balance).toEqual(100_000_000n);
      expect(poolData.domBalance).toEqual(50_000_000n);
    });
  
    it('should top up balance and update reserve', async () => {
      const gasPool = openSimplePool();
  
      await gasPool.sendDeploy(
        admin.getSender(),
        toNano('0.1')
      );
  
      const before = await gasPool.getPoolData();
  
      await gasPool.sendTopUp(
        admin.getSender(),
        {
          value: toNano('1'),
          queryId: 6n,
        }
      );
  
      const afterTopUp = await gasPool.getPoolData();
  
      await gasPool.sendSetReserve(
        admin.getSender(),
        {
          value: toNano('0.05'),
          reserveTonNano: toNano('0.3'),
          queryId: 7n,
        }
      );
  
      const afterReserve = await gasPool.getPoolData();
  
      expect(afterTopUp.availableTon > before.availableTon).toBe(true);
      expect(afterReserve.tonReserve).toEqual(toNano('0.3'));
      expect(afterReserve.availableTon < afterTopUp.availableTon).toBe(true);
    });
  
    it('should switch treasury after timelock', async () => {
      const gasPool = openSimplePool();
  
      await gasPool.sendDeploy(
        admin.getSender(),
        toNano('0.1')
      );
  
      const baseNow = (blockchain.now ?? Math.floor(Date.now() / 1000)) + 1;
  
      blockchain.now = baseNow;
  
      await gasPool.sendChangeTreasuryRequest(
        admin.getSender(),
        {
          value: toNano('0.05'),
          newTreasuryAddress: newTreasury.address,
          queryId: 8n,
        }
      );
  
      await ignoreFailure(
        gasPool.sendChangeTreasuryConfirm(
          admin.getSender(),
          {
            value: toNano('0.05'),
            queryId: 9n,
          }
        )
      );
  
      const beforeUnlock = await gasPool.getPoolData();
  
      expect(beforeUnlock.domTreasuryAddress.toString()).toEqual(treasuryOwner.address.toString());
  
      blockchain.now = baseNow + 61;
  
      await gasPool.sendChangeTreasuryConfirm(
        admin.getSender(),
        {
          value: toNano('0.05'),
          queryId: 10n,
        }
      );
  
      const afterUnlock = await gasPool.getPoolData();
      const pendingData = await gasPool.getPendingTreasury();
  
      expect(afterUnlock.domTreasuryAddress.toString()).toEqual(newTreasury.address.toString());
      expect(pendingData.hasPendingTreasury).toBe(false);
    });
  });