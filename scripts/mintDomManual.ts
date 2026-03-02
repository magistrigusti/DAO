import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { DomMaster } from '../wrappers/DomMaster';

function parseDomAmount(raw: string): bigint {
    const value = raw.trim();
    const parts = value.split('.');

    if (parts.length > 2) {
        throw new Error(
            `Invalid DOM amount format: ${raw}`
        );
    }

    const intPart = parts[0] || '0';
    const fracRaw = parts[1] || '';

    if (!/^[0-9]+$/.test(intPart)) {
        throw new Error(
            `Invalid DOM amount format: ${raw}`
        );
    }

    if (!/^[0-9]*$/.test(fracRaw)) {
        throw new Error(
            `Invalid DOM amount format: ${raw}`
        );
    }

    const fracPadded = (fracRaw + '000000').slice(0, 6);

    return BigInt(intPart) * 1_000_000n + BigInt(fracPadded);
}

export async function run(
    provider: NetworkProvider,
    args: string[]
) {
    if (args.length < 2) {
        throw new Error(
            'Usage: blueprint run mintDomManual <masterAddress> <amountDom> [tonValue] --testnet --tonconnect'
        );
    }

    const masterAddress = Address.parse(args[0]);
    const amountDom = parseDomAmount(args[1]);
    const tonValue = args[2] ? args[2] : '2';

    if (amountDom <= 0n) {
        throw new Error('Mint amount must be greater than zero.');
    }

    const master = provider.open(
        DomMaster.createFromAddress(masterAddress)
    );

    const ui = provider.ui();
    ui.write(
        `Sending OP_MINT to ${masterAddress.toString()}...`
    );

    await master.sendMint(provider.sender(), {
        value: toNano(tonValue),
        queryId: BigInt(Date.now()),
        amount: amountDom,
    });

    await provider.waitForLastTransaction();

    const totalSupply = await master.getTotalSupply();
    ui.write(
        `Mint sent successfully. Total supply: ${totalSupply.toString()}`
    );
}
