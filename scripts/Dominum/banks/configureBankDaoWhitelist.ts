import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { BankDao } from '../../../wrappers/Dominum/banks/BankDao';

export type BankDaoWhitelistTarget = {
  address: Address;
  label?: string;
  remove?: boolean;
  queryId?: bigint;
  value?: bigint;
};

export async function configureBankDaoWhitelist(
  provider: NetworkProvider,
  bankDao: OpenedContract<BankDao>,
  targets: readonly BankDaoWhitelistTarget[]
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  for (const target of targets) {
    const value = target.value ?? toNano('0.05');
    const label = target.label ?? target.address.toString();

    if (target.remove) {
      await bankDao.sendRemoveWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`BankDao whitelist removed: ${label}`);
    } else {
      await bankDao.sendAddWhitelist(sender, {
        value,
        address: target.address,
        queryId: target.queryId ?? 0n,
      });
      ui.write(`BankDao whitelist added: ${label}`);
    }

    await provider.waitForLastTransaction();
  }
}