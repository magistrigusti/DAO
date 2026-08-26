import {
  loadAllodiumBootstrapConfig,
  loadAllodiumDeploymentAddresses,
} from './Allodium/core/config';
import { compileAllodium } from './Allodium/allod/compileAllodium';
import {
  openAllodiumBootstrap,
} from './Allodium/allod/configureAllodium';
import {
  assertAllodiumReady,
} from './Allodium/allod/preflightAllodium';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

async function main(): Promise<void> {
  const provider = await createDomProvider();
  const config = loadAllodiumBootstrapConfig();
  const addresses = loadAllodiumDeploymentAddresses();
  const compiled = await compileAllodium(provider);
  const contracts = openAllodiumBootstrap(provider, addresses);

  await assertAllodiumReady(
    provider,
    contracts,
    compiled,
    config,
    addresses
  );
  provider.ui().write('ALLODIUM PREFLIGHT: OK');
  provider.ui().write('No transaction was submitted.');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
