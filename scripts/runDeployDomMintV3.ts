import { run as runDeployDomMint } from './Dominum/dom/deployDomMint';
import { createToncenterV3TestnetNetworkProvider } from './runtime/toncenter-v3/ToncenterV3NetworkProvider';

async function main() {
  const provider = await createToncenterV3TestnetNetworkProvider();
  await runDeployDomMint(provider);
}
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});