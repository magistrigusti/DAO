import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { BankDominum } from '../../../wrappers/Dominum/banks/BankDominum';

export type BankDominumWhitelistTarget = {
  address: Address;
  label?: string;
  remove?: boolean;
  queryId?: bigint;
  value?: bigint;
};

export async function configureBankDominumWhitelist(
  provider: NetworkProvider,
  bankDominum: OpenedContract<BankDominum>,
  targets: readonly BankDominumWhitelistTarget[]
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  for (const target of targets) {
    const value = target.value ?? toNano('0.05');
    const label = target.label ?? target.address.toString();

    if (target.remove) {
      await bankDominum.sendRemoveWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`BankDominum whitelist removed: ${label}`);
    } else {
      await bankDominum.sendAddWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`BankDominum whitelist added: ${label}`);
    }

    await provider.waitForLastTransaction();
  }
}