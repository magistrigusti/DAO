import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DaoFoundation } from '../../../wrappers/Dominum/foundation/DaoFoundation';

export type DaoFoundationWhitelistTarget = {
  address: Address;
  label?: string;
  remove?: boolean;
  queryId?: bigint;
  value?: bigint;
};

export async function configureDaoFoundationWhitelist(
  provider: NetworkProvider,
  daoFoundation: OpenedContract<DaoFoundation>,
  targets: readonly DaoFoundationWhitelistTarget[]
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  for (const target of targets) {
    const value = target.value ?? toNano('0.05');
    const label = target.label ?? target.address.toString();

    if (target.remove) {
      await daoFoundation.sendRemoveWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`DaoFoundation whitelist removed: ${label}`);
    } else {
      await daoFoundation.sendAddWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`DaoFoundation whitelist added: ${label}`);
    }

    await provider.waitForLastTransaction();
  }
}