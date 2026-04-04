# DOM Token Release TODO

## Цель
- [ ] Выпустить DOM на `testnet` через новый deploy-flow.
- [ ] Проверить первый mint, gas pipeline и авто-настройку гиверов.
- [ ] После успешного `testnet` подготовить чистую дорожку для `mainnet`.

## Что уже сделано

### Контракты
- [x] Mint перенесён в `master.tolk`, отдельный `minter` убран.
- [x] `master.tolk` работает как owner-based mint с лимитами по времени и количеству.
- [x] `wallet.tolk` исправлен под нормальный `wallet -> gas proxy -> gas pool` flow.
- [x] `MAX_SUPPLY` приведён к корректному значению для `1_000_000_000 DOM` c `6 decimals`.

### Тесты
- [x] Есть sandbox-тест минта: `tests/Dominum/dom/mint-flow.sandbox.test.ts`.
- [x] Есть sandbox-тест gas pipeline: `tests/Dominum/treasury/gas-pool-transfer.sandbox.test.ts`.

### Wrappers и compile
- [x] Есть wrappers для `DomMaster`, `DomWallet`, `GasProxy`, `GasPool`.
- [x] Есть wrappers для 4 гиверов и `GiverManager`.
- [x] Есть compile-файлы для DOM, treasury и givers в `compilables/Dominum/...`.

### Metadata
- [x] Есть `metadata/dom-metadata.json`.
- [x] Заполнены `name`, `symbol`, `decimals`, `description`, `image`.
- [x] В `scripts/Dominum/core/config.ts` уже указан `METADATA_URL`.

### Новая архитектура deploy-скриптов
- [x] Есть `scripts/Dominum/core/config.ts`.
- [x] Есть `scripts/Dominum/core/helpers.ts`.
- [x] Есть `scripts/Dominum/core/types.ts`.
- [x] Есть `scripts/Dominum/dom/compileContracts.ts`.
- [x] Есть `scripts/Dominum/givers/deployGivers.ts`.
- [x] Есть `scripts/Dominum/management/deployGiverManager.ts`.
- [x] Есть `scripts/Dominum/dom/deployTokenGraph.ts`.
- [x] Есть `scripts/Dominum/treasury/configureGasPipeline.ts`.
- [x] Есть `scripts/Dominum/management/configureGiverWallets.ts`.
- [x] Есть `scripts/Dominum/management/configureTokenGraph.ts` как файл-меню.
- [x] Есть новый orchestrator: `scripts/Dominum/dom/deployDomMint.ts`.

## Что сейчас реально блокирует выпуск

### Блокер 1. Два entrypoint для deploy
- [ ] В проекте одновременно живут:
- [ ] `scripts/deployDomMint.ts` — старый монолитный сценарий.
- [ ] `scripts/Dominum/dom/deployDomMint.ts` — новый короткий orchestrator.
- [ ] Нужно оставить один главный entrypoint и не путаться при запуске.

### Блокер 2. Неправильные import-пути в новом entrypoint
- [ ] В `scripts/Dominum/dom/deployDomMint.ts` сейчас импорты смотрят на `./Dominum/dom/...`, хотя файл уже лежит внутри `scripts/Dominum/dom/`.
- [ ] Нужно привести пути к реальной структуре папок.

### Блокер 3. Путаница по папкам
- [ ] Сейчас по смыслу есть шум между папками `dom`, `management`, `treasury`, `foundation`.
- [ ] `configureTokenGraph.ts` лежит в `management`, хотя по смыслу это orchestration-слой.
- [ ] `deployInfrastructure.ts` и `mintAndReport.ts` сейчас живут в `foundation`, хотя по смыслу это не foundation.
- [ ] Нужно договориться о финальной карте папок и не таскать файлы между доменами.

### Блокер 4. `mintAndReport.ts` ещё не финализирован как слой
- [ ] Есть файл `scripts/Dominum/foundation/mintAndReport.ts`.
- [ ] Нужно решить его окончательное место и считать его каноническим.
- [ ] После этого проверить, что именно он импортируется из главного entrypoint.

### Блокер 5. Nested `compilables`
- [ ] Compile-файлы лежат во вложенных папках `compilables/Dominum/...`.
- [ ] В `blueprint.config.ts` сейчас есть только `separateCompilables: true`.
- [ ] Проверить, нужен ли `recursiveWrappers: true`, чтобы Blueprint гарантированно видел вложенные compile-файлы.

## Что надо сделать прямо сейчас, чтобы не тупить

### Шаг 1. Зафиксировать каноническую структуру
- [ ] Оставить только одну карту ответственности:
- [ ] `core` = config, helpers, types
- [ ] `treasury` = gas pipeline
- [ ] `management` = deploy manager + configure giver wallets
- [ ] `givers` = deploy 4 гиверов
- [ ] `dom` = compile, deploy token graph, главный entrypoint deploy-а
- [ ] `mintAndReport` положить туда, где он реально является частью orchestration, и больше не дёргать между папками

### Шаг 2. Убрать дубли
- [ ] Удалить или заморозить старый `scripts/deployDomMint.ts`.
- [ ] Убедиться, что в проекте остаётся только один рабочий deploy entrypoint.

### Шаг 3. Проверить orchestration
- [ ] `compileContracts`
- [ ] `deployInfrastructure`
- [ ] `deployTokenGraph`
- [ ] `configureTokenGraph`
- [ ] `mintAndReport`
- [ ] Проверить, что именно в таком порядке всё вызывается из главного deploy-скрипта.

### Шаг 4. Проверить зависимости между контрактами
- [ ] `GiverManager` деплоится раньше гиверов.
- [ ] Все гиверы получают `managerAddress = giverManager.address`.
- [ ] После deploy `DomMaster` всем 4 гиверам проставляются их `walletAddress`.
- [ ] `GasProxy.sendSetWalletConfig(...)` вызывается до первого минта.
- [ ] После timelock `GasProxy` переключается на реальный `GasPool`.

## Чеклист перед первым запуском на testnet
- [ ] Проверить `metadata/dom-metadata.json`.
- [ ] Проверить, что `image` URL реально открывается извне.
- [ ] Проверить, что `METADATA_URL` реально открывается извне.
- [ ] Проверить `blueprint.config.ts`.
- [ ] Проверить compile-файлы в `compilables/Dominum/...`.
- [ ] Проверить один главный deploy entrypoint.
- [ ] Запустить `npm run compile`.
- [ ] Запустить `npx tsc --noEmit`.
- [ ] Запустить `npm test`.

## Чеклист первого выпуска DOM на testnet
- [ ] 1. Deploy `GasProxy`.
- [ ] 2. Deploy `GasPool`.
- [ ] 3. Deploy `GiverManager`.
- [ ] 4. Deploy 4 гивера.
- [ ] 5. Deploy `DomMaster`.
- [ ] 6. Настроить `GasProxy.sendSetWalletConfig(...)`.
- [ ] 7. Запустить timelock на смену `GasPool`.
- [ ] 8. Подтвердить смену `GasPool` после timelock.
- [ ] 9. Проставить `walletAddress` всем 4 гиверам.
- [ ] 10. Отправить первый mint.
- [ ] 11. Проверить `totalSupply`.
- [ ] 12. Проверить wallet-адреса гиверов.
- [ ] 13. Проверить балансы после минта.
- [ ] 14. Проверить, что авто-распределение реально стартует.
- [ ] 15. Сохранить все адреса развёрнутых контрактов в отдельный файл или документ.

## Что оставить на потом, после testnet
- [ ] Решить, оставляем `GitHub raw` для metadata/image или переносим на `IPFS`.
- [ ] Отдельно сделать чистый `mainnet` checklist.
- [ ] Убрать временные адреса `deployer` из конфигов гиверов и заменить их на реальные адреса экосистемы.
- [ ] После удачного `testnet` обновить документацию по deploy-порядку.

## Правило, чтобы не тупить дальше
- [ ] Один файл = одна ответственность.
- [ ] Один deploy entrypoint = один источник истины.
- [ ] Один домен = одна папка.
- [ ] Перед любым реальным deploy всегда запускать:
- [ ] `npm run compile`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`