import {
  NetworkProvider,
} from '@ton/blueprint';

import { compileContracts } from './compileContracts';
import { deployInfrastructure } from '../foundation/deployInfrastructure';
import { deployTokenGraph } from './deployTokenGraph';
import { configureTokenGraph } from '../management/configureTokenGraph';
import { mintAndReport } from '../foundation/mintAndReport';

export async function run(
  provider: NetworkProvider
) {
  const ui = provider.ui();
  const sender = provider.sender();
  const deployer = sender.address;

  if (!deployer) {
      throw new Error(
          'Sender address is not available'
      );
  }

  ui.write('========== DOM DEPLOY START ==========');
  ui.write(
      `Deployer: ${deployer.toString()}`
  );

  const compiled = await compileContracts(
      provider
  );

  const infrastructure =
      await deployInfrastructure(
          provider,
          compiled,
          deployer
      );

  const graph = await deployTokenGraph(
      provider,
      compiled,
      infrastructure,
      deployer
  );

  await configureTokenGraph(
      provider,
      compiled,
      infrastructure,
      graph
  );

  await mintAndReport(
      provider,
      infrastructure,
      graph
  );

  ui.write('========== DOM DEPLOY END ==========');
}