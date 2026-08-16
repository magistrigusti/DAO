import { DomMaster } from '../wrappers/Dominum/dom/DomMaster';
import {
  loadDomDeploymentAddresses,
  loadDomDistributionAddresses,
  loadDomRecipientOwnerAddresses,
} from './Dominum/core/config';
import {
  configureRecipientAction,
} from './Dominum/foundation/configureRecipients';
import {
  deriveRecipientOwnerCodeHash,
  openDomRecipients,
  printRecipientStatus,
} from './Dominum/foundation/recipientStatus';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

async function main(): Promise<void> {
  const provider = await createDomProvider();
  const action = process.env.DOM_RECIPIENT_ACTION ?? 'status';

  if (action === 'owner-code-hash') {
    const owners = loadDomRecipientOwnerAddresses();
    const hash = await deriveRecipientOwnerCodeHash(provider, owners);
    provider.ui().write(`DOM_RECIPIENT_OWNER_CODE_HASH=${hash}`);
    return;
  }

  const deployment = loadDomDeploymentAddresses();
  const distribution = loadDomDistributionAddresses();
  const master = provider.open(
    DomMaster.createFromAddress(deployment.domMaster)
  );
  const recipients = openDomRecipients(provider, distribution);

  provider.ui().write(`DOM_RECIPIENT_ACTION=${action}`);

  if (action === 'status') {
    const valid = await printRecipientStatus(
      provider,
      master,
      recipients
    );

    if (!valid) {
      throw new Error('DOM recipient configuration is incomplete');
    }

    return;
  }

  await configureRecipientAction(
    provider,
    master,
    recipients,
    action
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
