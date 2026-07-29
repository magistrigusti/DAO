import {
  compile,
  NetworkProvider,
} from '@ton/blueprint';

import { CompiledContracts } from '../core/types';

const CONTRACTS = {
  wallet: 'Dominum/dom/DomWallet',
  master: 'Dominum/dom/DomMaster',

  treasuryManager: 'Dominum/management/TreasuryManager',
  treasuryPool: 'Dominum/treasury/TreasuryPool',
  gasPool: 'Dominum/pools/GasPool',

  minter: 'Dominum/treasury/Minter',
  minterManager: 'Dominum/management/MinterManager',

  giverAllodium: 'Dominum/givers/GiverAllodium',
  giverDefi: 'Dominum/givers/GiverDefi',
  giverDao: 'Dominum/givers/GiverDao',
  giverDominum: 'Dominum/givers/GiverDominum',

  giverManager: 'Dominum/management/GiverManager',

  frsAllodium: 'Allodium/treasury/FrsAllodium',
  allodiumFoundation: 'Allodium/foundation/AllodiumFoundation',
  marketMaker: 'Dominum/defi/MarketMaker',
  foundryLock: 'Dominum/invest/FoundryLock',
  bankDefi: 'Dominum/banks/BankDefi',
  bankDao: 'Dominum/banks/BankDao',
  daoFoundation: 'Dominum/dao/DaoFoundation',
  bankDominum: 'Dominum/banks/BankDominum',
  dominumFoundation: 'Dominum/foundation/DominumFoundation',
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

    frsAllodiumCode: await compile(CONTRACTS.frsAllodium),
    allodiumFoundationCode:
      await compile(CONTRACTS.allodiumFoundation),
    marketMakerCode: await compile(CONTRACTS.marketMaker),
    foundryLockCode: await compile(CONTRACTS.foundryLock),
    bankDefiCode: await compile(CONTRACTS.bankDefi),
    bankDaoCode: await compile(CONTRACTS.bankDao),
    daoFoundationCode: await compile(CONTRACTS.daoFoundation),
    bankDominumCode: await compile(CONTRACTS.bankDominum),
    dominumFoundationCode:
      await compile(CONTRACTS.dominumFoundation),
  };

  ui.write('All DOM contracts compiled.');

  return compiled;
}
