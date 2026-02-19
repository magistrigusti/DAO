import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/Dominum/management/giver_manager.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
