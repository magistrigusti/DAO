# Деплой DOM Core — пошагово

## 1. Открой терминал в папке проекта

```
cd c:\projects\DAO
```

## 2. Собери все контракты

```
npx blueprint build --all
```

Дождись окончания. Ничего не выбирай — просто Enter если спросит.

## 3. Запусти деплой

```
npm run deploy
```

## 4. Выбери скрипт

В списке стрелками выбери **deployDomCoreTestnet** и нажми Enter.

## 5. Подключи кошелёк

Появится QR или TonConnect. Подключи тот же кошелёк, что в приложении (master test wallet).

## 6. Подтверди транзакции

В кошельке подтверди все транзакции подряд (их будет несколько).

## 7. Подожди 1 минуту

Timelock на testnet = 60 секунд.

## 8. Подтверди Gas Pool

Снова в терминале:

```
npx blueprint run confirmGasProxyPool EQ...адрес_GasProxy... --testnet --tonconnect
```

Адрес GasProxy был в выводе шага 6 (строка `GasProxy: EQ...`).

## 9. Сохрани адреса

Открой приложение → Monitor → вставь адреса Master, GasProxy, GasPool → «Сохранить контракты».

---

**Готово.** Теперь можно минтить через Mint в приложении или через `npm run deploy` → **mintDomManual**.
