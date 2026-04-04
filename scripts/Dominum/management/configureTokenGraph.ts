import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

import { configureGasPipeline } from '../treasury/configureGasPipeline';
import { configureGiverWallets } from './configureGiverWallets';

export async function configureTokenGraph(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts
): Promise<void> {
  await configureGasPipeline(
      provider,
      compiled,
      infrastructure,
      graph
  );

  await configureGiverWallets(
      provider,
      graph
  );
}