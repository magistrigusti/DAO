import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/givers/giver_defi.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
