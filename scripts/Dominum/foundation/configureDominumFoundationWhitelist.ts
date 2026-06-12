import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DominumFoundation } from '../../../wrappers/Dominum/foundation/DominumFoundation';

export type DominumFoundationWhitelistTarget = {
  address: Address;
  label?: string;
  remove?: boolean;
  queryId?: bigint;
  value?: bigint;
};

export async function configureDominumFoundationWhitelist(
  provider: NetworkProvider,
  dominumFoundation: OpenedContract<DominumFoundation>,
  targets: readonly DominumFoundationWhitelistTarget[]
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  for (const target of targets) {
    const value = target.value ?? toNano('0.05');
    const label = target.label ?? target.address.toString();

    if (target.remove) {
      await dominumFoundation.sendRemoveWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`DominumFoundation whitelist removed: ${label}`);
    } else {
      await dominumFoundation.sendAddWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`DominumFoundation whitelist added: ${label}`);
    }

    await provider.waitForLastTransaction();
  }
}