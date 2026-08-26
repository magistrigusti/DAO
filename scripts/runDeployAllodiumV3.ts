import { NetworkProvider } from '@ton/blueprint';
import { loadAllodiumBootstrapConfig } from './Allodium/core/config';
import { compileAllodium } from './Allodium/allod/compileAllodium';
import {
  deployAllodiumBootstrap,
} from './Allodium/allod/deployAllodium';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

function report(
  provider: NetworkProvider,
  name: string,
  value: { toString(): string }
): void {
  provider.ui().write(`${name}=${value.toString()}`);
}

async function main(): Promise<void> {
  const provider = await createDomProvider();
  const config = loadAllodiumBootstrapConfig();
  const compiled = await compileAllodium(provider);
  const contracts = await deployAllodiumBootstrap(
    provider,
    compiled,
    config
  );

  provider.ui().write('ALLODIUM BOOTSTRAP ADDRESS VARIABLES');
  report(
    provider,
    'ALLODIUM_GAS_POOL_ADDRESS',
    contracts.allodGasPool.address
  );
  report(
    provider,
    'ALLODIUM_MASTER_ADDRESS',
    contracts.allodMaster.address
  );
  provider.ui().write(
    'Deploy DOM recipients before configuring the real FRS address.'
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
