# Dominum Contracts Monitor Node

Нода-монитор для чтения данных из контрактов и расчёта метрик пулов.

## Что делает

- Читает `getPoolData()` у `gas_pool`.
- Считает:
  - `priceTonPerDom` (текущая техническая цена из резервов),
  - `domDelta` и `tonDelta` (изменение балансов между циклами).
- Опционально читает `market_maker`:
  - `getMarketData()`,
  - `getWalletData()` у его DOM wallet,
  - TON баланс самого `market_maker`.
- Пишет последний снапшот в JSON файл.

## Установка

```bash
cd tools/contracts-monitor-node
npm install
```

## Настройка

1. Скопируй `.env.example` в `.env`.
2. Заполни:
   - `TON_ENDPOINT`
   - `GAS_POOL_ADDRESS`
   - `MARKET_MAKER_ADDRESS` (опционально)

## Запуск

```bash
npm run dev
```

Или build + start:

```bash
npm run build
npm run start
```

## Формула цены

`priceTonPerDom` считается так:

`(availableTon / 10^TON_DECIMALS) / (domBalance / 10^DOM_DECIMALS)`

Сейчас это техническая метрика по состоянию пула,
а не рыночная цена внешних DEX.
