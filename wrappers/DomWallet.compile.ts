import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/dom/wallet.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
