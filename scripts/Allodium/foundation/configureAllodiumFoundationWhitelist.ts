import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { AllodiumFoundation } from '../../../wrappers/Allodium/foundation/AllodiumFoundation';

export type AllodiumFoundationWhitelistTarget = {
    address: Address;
    label?: string;
    remove?: boolean;
    queryId?: bigint;
    value?: bigint;
};

export async function configureAllodiumFoundationWhitelist(
    provider: NetworkProvider,
    foundation: OpenedContract<AllodiumFoundation>,
    targets: readonly AllodiumFoundationWhitelistTarget[]
): Promise<void> {
    const ui = provider.ui();
    const sender = provider.sender();

    for (const target of targets) {
        const value = target.value ?? toNano('0.05');
        const label = target.label ?? target.address.toString();
    }
}