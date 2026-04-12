import {
    compile,
    NetworkProvider,
  } from '@ton/blueprint';
  
  import { CompiledContracts } from '../core/types';
  
  // ========== КОРОТКИЕ ИМЕНА ДЛЯ COMPILE ==========
  const CONTRACTS = {
    wallet: 'Dominum/dom/DomWallet',
    master: 'Dominum/dom/DomMaster',
    gasProxy: 'Dominum/treasury/GasProxy',
    gasPool: 'Dominum/treasury/GasPool',
    giverAllodium: 'Dominum/givers/GiverAllodium',
    giverDefi: 'Dominum/givers/GiverDefi',
    giverDao: 'Dominum/givers/GiverDao',
    giverDominum: 'Dominum/givers/GiverDominum',
    giverManager: 'Dominum/givers/GiverManager',
  } as const;
  
  export async function compileContracts(
    provider: NetworkProvider
  ): Promise<CompiledContracts> {
    const ui = provider.ui();
  
    ui.write('Compiling contracts...');
  
    const compiled: CompiledContracts = {
      walletCode: await compile(CONTRACTS.wallet),
      masterCode: await compile(CONTRACTS.master),
      gasProxyCode: await compile(CONTRACTS.gasProxy),
      gasPoolCode: await compile(CONTRACTS.gasPool),
      giverAllodiumCode: await compile(CONTRACTS.giverAllodium),
      giverDefiCode: await compile(CONTRACTS.giverDefi),
      giverDaoCode: await compile(CONTRACTS.giverDao),
      giverDominumCode: await compile(CONTRACTS.giverDominum),
      giverManagerCode: await compile(CONTRACTS.giverManager),
    };
  
    ui.write('All contracts compiled.');
  
    return compiled;
  }