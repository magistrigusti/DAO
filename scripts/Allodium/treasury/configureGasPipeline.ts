// Совместимая точка импорта для старых deploy-сценариев.
// Реальная конфигурация ALLOD выполняется специализированным модулем.

export {
  configureAllodGasPool as configureGasPipeline,
} from '../pools/configureAllodGasPool';

export type {
  ConfigureAllodGasPoolOptions as ConfigureGasPipelineOptions,
} from '../pools/configureAllodGasPool';
