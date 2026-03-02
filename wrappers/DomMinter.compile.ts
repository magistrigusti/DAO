import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/dom/minter.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
