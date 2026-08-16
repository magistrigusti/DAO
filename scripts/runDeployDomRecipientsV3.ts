import { Address, OpenedContract } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import {
  loadDomRecipientDependencies,
  loadDomRecipientOwnerAddresses,
} from './Dominum/core/config';
import {
  deployPreGraphRecipients,
} from './Dominum/foundation/deployRecipients';
import { compileContracts } from './Dominum/dom/compileContracts';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

function writeAddress(
  provider: NetworkProvider,
  name: string,
  address: Address
): void {
  provider.ui().write(`${name}=${address.toString()}`);
}

function reportRecipients(
  provider: NetworkProvider,
  recipients: Record<string, OpenedContract<any>>
): void {
  const names: Record<string, string> = {
    frsAllodium: 'DOM_RECIPIENT_ALLODIUM_FRS_ADDRESS',
    allodiumFoundation: 'DOM_RECIPIENT_ALLODIUM_FOUNDATION_ADDRESS',
    defiMarket: 'DOM_RECIPIENT_DEFI_MARKET_ADDRESS',
    defiFoundry: 'DOM_RECIPIENT_DEFI_FOUNDRY_ADDRESS',
    defiTreasury: 'DOM_RECIPIENT_DEFI_TREASURY_ADDRESS',
    daoBank: 'DOM_RECIPIENT_DAO_BANK_ADDRESS',
    daoFoundation: 'DOM_RECIPIENT_DAO_FOUNDATION_ADDRESS',
    dominumFoundation: 'DOM_RECIPIENT_DOMINUM_FOUNDATION_ADDRESS',
  };

  Object.entries(recipients).forEach(([key, contract]) => {
    writeAddress(provider, names[key], contract.address);
  });
}

async function main(): Promise<void> {
  const provider = await createDomProvider();
  const compiled = await compileContracts(provider);
  const owners = loadDomRecipientOwnerAddresses();
  const dependencies = loadDomRecipientDependencies();
  const recipients = await deployPreGraphRecipients(
    provider,
    compiled,
    owners,
    dependencies
  );

  provider.ui().write('PRE-GRAPH RECIPIENT ADDRESS VARIABLES');
  reportRecipients(provider, recipients);
  provider.ui().write(
    'Save these addresses before deploying the DOM contract graph.'
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
