import {
  compile,
  NetworkProvider,
} from '@ton/blueprint';

import { CompiledContracts } from '../core/types';

const CONTRACTS = {
  wallet: 'Dominum/dom/DomWallet',
  master: 'Dominum/dom/DomMaster',

  treasuryManager: 'Dominum/treasury/TreasuryManager',
  treasuryPool: 'Dominum/treasury/TreasuryPool',
  gasPool: 'Dominum/pools/GasPool',

  minter: 'Dominum/treasury/Minter',
  minterManager: 'Dominum/management/MinterManager',

  giverAllodium: 'Dominum/givers/GiverAllodium',
  giverDefi: 'Dominum/givers/GiverDefi',
  giverDao: 'Dominum/givers/GiverDao',
  giverDominum: 'Dominum/givers/GiverDominum',

  // Файл compile сейчас лежит в compilables/Dominum/givers/GiverManager.compile.ts
  giverManager: 'Dominum/givers/GiverManager',
} as const;

export async function compileContracts(
  provider: NetworkProvider
): Promise<CompiledContracts> {
  const ui = provider.ui();

  ui.write('Compiling DOM contracts...');

  const compiled: CompiledContracts = {
    walletCode: await compile(CONTRACTS.wallet),
    masterCode: await compile(CONTRACTS.master),

    treasuryManagerCode: await compile(CONTRACTS.treasuryManager),
    treasuryPoolCode: await compile(CONTRACTS.treasuryPool),
    gasPoolCode: await compile(CONTRACTS.gasPool),

    minterCode: await compile(CONTRACTS.minter),
    minterManagerCode: await compile(CONTRACTS.minterManager),

    giverAllodiumCode: await compile(CONTRACTS.giverAllodium),
    giverDefiCode: await compile(CONTRACTS.giverDefi),
    giverDaoCode: await compile(CONTRACTS.giverDao),
    giverDominumCode: await compile(CONTRACTS.giverDominum),
    giverManagerCode: await compile(CONTRACTS.giverManager),
  };

  ui.write('All DOM contracts compiled.');

  return compiled;
}