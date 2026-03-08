import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address } from '@ton/core';
import { printTransactionFees } from '@ton/sandbox';
import { DomMaster } from '../../../wrappers/DomMaster';
import { DomWallet } from '../../../wrappers/DomWallet';
import { GasPool } from '../../../wrappers/GasPool';
import { GasProxy } from '../../../wrappers/GasProxy';
import { compile } from '@ton/blueprint';

describe('Gas Pool transfer', () => {
  let blockchain: Blockchain;
  let domMaster: SandboxContract<DomMaster>;
  let gasPool: SandboxContract<GasPool>;
  let gasProxy: SandboxContract<GasProxy>;
  let sender: SandboxContract<TreasuryContract>;
  let receiver: SandboxContract<TreasuryContract>;
  let treasuryOwner: SandboxContract<TreasuryContract>;

  beforeAll(async () => {
    blockchain = await Blockchain.create();
    sender = await blockchain.treasury('sender');
    receiver = await blockchain.treasury('receiver');
    treasuryOwner = await blockchain.treasury('treasury');
  
    const walletCode = Cell.fromBoc(
      (await complite('DomWallet')).code.toBoc()
    )[0];
    const masterCode = Cell.fromBoc(
      (await compile('DomMaster')).code.toBoc()
    )[0];
    const gasPoolCode = Cell.fromBoc(
      (await compile('GasPool')).code.toBoc()
    )[0];
    const gasProxyCode = Cell.fromBoc(
      (await compile('GasProxy')).code.toBoc()
    )[0];

    const gasProxyConfig = {
      adminAddress: sender.address,
      realGasPoolAddress: Address.parseRaw(''),
      walletConfigReady: false,
      hasPending: false,
    };
    const gasProxyContract = GasProxy.createFromConfig(
      gasProxyConfig as any,
      gasProxyCode
    );
    const gasProxyAddr = gasProxyContract.address;

    const gasPoolConfig = {
      adminAddress: sender.address,
      proxyAddress: gasProxyAddr,
      domTreasuryAddress: treasuryOwner.address,
      domBalance: 0n,
      tonReserve: 0n,
      hasPendingTreasury: false,
    };
    gasPool = blockchain.openContract(
      GasPool.createFromConfig(gasPoolConfig as any, gasPoolCode)
    );
    await gasPool.init?.();

    const gasProxyFullConfig = {
      ...gasProxyConfig,
      realGasPoolAddress: gasPool.address,
    };
    gasProxy = blockchain.openContract(
      GasProxy.createFromConfig(gasProxyFullConfig as any, gasProxyCode)
    );
    await gasProxy.init?.();

    const content = Cell.EMPTY;
    const giver1 = await blockchain.treasury('g1');
    const giver2 = await blockchain.treasury('g2');
    const giver3 = await blockchain.treasury('g3');
    const giver4 = await blockchain.treasury('g4');
    const minterAddr = await blockchain.treasury('minter').address;

    const masterConfig = {
      totalSupply: 0n,
      minterAddress: minterAddr,
      gasPoolAddress: gasProxy.address,
      giverAllodiumAddress: giver1.address,
      giverDefiAddress: giver2.address,
      giverDaoAddress: giver3.address,
      giverDominumAddress: giver4.address,
      content,
      jettonWalletCode: walletCode,
    };
    domMaster = blockchain.openContract(
      DomMaster.createFromConfig(masterConfig, masterCode)
    );
    await domMaster.init?.();

    await gasProxy.sendSetWalletConfig(sender.getSender(), {
      value: toNano('0.05'),
      masterAddress: domMaster.address,
      jettonWalletCode: walletCode,
    } as any);

    const minterCode = Cell.fromBoc(
      (await compile('DomMinter')).code.toBoc()
    )[0];
    const minterConfig = {
      adminAddress: minterAddr,
      masterAddress: domMaster.address,
      lastMintTime: 0n,
      isStarted: false,
    };
    const domMinter = blockchain.openContract(
      DomMinter.createFromConfig(minterConfig as any, minterCode)
    );
    await domMinter.sendMint(
      { getSender: () => blockchain.sender(minterAddr) } as any,
      { value: toNano('1'), aamount: 10_000_000_000_000n } as any
    );
  });

  
})