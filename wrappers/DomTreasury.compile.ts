import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/treasury/dom_treasury.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
