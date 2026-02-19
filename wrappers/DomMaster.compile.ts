import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/dom/master.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
