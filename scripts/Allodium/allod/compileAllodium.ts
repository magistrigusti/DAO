import { compile, NetworkProvider } from '@ton/blueprint';
import { CompiledAllodiumContracts } from '../core/types';

const CONTRACTS = {
  allodMaster: 'Allodium/allod/AllodMaster',
  allodWallet: 'Allodium/allod/AllodWallet',
  allodGasPool: 'Allodium/pools/AllodGasPool',
  frsAllodium: 'Allodium/treasury/FrsAllodium',
  allodiumFoundation: 'Allodium/foundation/AllodiumFoundation',
} as const;

export async function compileAllodium(
  provider: NetworkProvider
): Promise<CompiledAllodiumContracts> {
  provider.ui().write('Compiling Allodium contracts...');

  const compiled: CompiledAllodiumContracts = {
    allodMasterCode: await compile(CONTRACTS.allodMaster),
    allodWalletCode: await compile(CONTRACTS.allodWallet),
    allodGasPoolCode: await compile(CONTRACTS.allodGasPool),
    frsAllodiumCode: await compile(CONTRACTS.frsAllodium),
    allodiumFoundationCode:
      await compile(CONTRACTS.allodiumFoundation),
  };

  provider.ui().write('All Allodium contracts compiled.');
  return compiled;
}
