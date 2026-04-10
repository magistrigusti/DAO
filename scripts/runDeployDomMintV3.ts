import { run as runDeployDomMint } from './Dominum/dom/deployDomMint';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

async function main() {
  const provider = await createDomProvider();
  await runDeployDomMint(provider);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});