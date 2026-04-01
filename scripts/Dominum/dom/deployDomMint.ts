import {
  NetworkProvider,
} from '@ton/blueprint';

import { compileContracts } from './Dominum/dom/compileContracts';
import { deployInfrastructure } from './Dominum/dom/deployInfrastructure';
import { deployTokenGraph } from './Dominum/dom/deployTokenGraph';
import { configureTokenGraph } from './Dominum/dom/configureTokenGraph';
import { mintAndReport } from './Dominum/dom/mintAndReport';

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