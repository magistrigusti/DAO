import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { GasProxy } from '../wrappers/GasProxy';

export async function run(
    provider: NetworkProvider,
    args: string[]
) {
    if (args.length < 1) {
        throw new Error(
            'Usage: blueprint run confirmGasProxyPool <gasProxyAddress> --testnet --tonconnect'
        );
    }

    const gasProxyAddress = Address.parse(args[0]);
    const gasProxy = provider.open(
        GasProxy.createFromAddress(gasProxyAddress)
    );

    const ui = provider.ui();

    ui.write('Confirming timelock change on GasProxy...');
    await gasProxy.sendConfirmChangePool(provider.sender(), {
        value: toNano('0.1'),
        queryId: BigInt(Date.now()),
    });
    await provider.waitForLastTransaction();

    const proxyData = await gasProxy.getProxyData();

    ui.write('GasProxy timelock confirmed.');
    ui.write(
        `Real Gas Pool: ${proxyData.realGasPoolAddress.toString()}`
    );
    ui.write(`Has pending: ${String(proxyData.hasPending)}`);
}
