import { Config } from '@ton/blueprint';

export const config: Config = {
    separateCompilables: true,
    // Сеть для деплоя (testnet для разработки)
    network: {
        endpoint: 'https://testnet.toncenter.com/api/v3/jsonRPC',
        type: 'testnet',
        key: process.env.DOMINUM_TESTNET_API_KEY || '',
    },
};
