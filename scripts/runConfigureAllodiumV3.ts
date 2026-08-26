import {
  loadAllodiumBootstrapConfig,
  loadAllodiumDeploymentAddresses,
} from './Allodium/core/config';
import { compileAllodium } from './Allodium/allod/compileAllodium';
import {
  configureAllodiumAction,
  openAllodiumBootstrap,
} from './Allodium/allod/configureAllodium';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

async function main(): Promise<void> {
  const provider = await createDomProvider();
  const action = process.env.ALLODIUM_CONFIG_ACTION;

  if (!action) {
    throw new Error('ALLODIUM_CONFIG_ACTION is required');
  }

  const config = loadAllodiumBootstrapConfig();
  const addresses = loadAllodiumDeploymentAddresses();
  const compiled = await compileAllodium(provider);
  const contracts = openAllodiumBootstrap(provider, addresses);

  provider.ui().write(`ALLODIUM_CONFIG_ACTION=${action}`);
  await configureAllodiumAction(
    provider,
    contracts,
    compiled,
    config,
    addresses,
    action
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
