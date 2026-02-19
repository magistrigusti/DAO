import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/treasury/gas_pool.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
