# Архитектура смарт-контрактов Dominum / Allodium

> Цифровая схема контрактов построена по текущему рабочему дереву проекта
> `C:\projects\DAO` на 23 июня 2026 года.
>
> Схема отражает фактический код, включая незакоммиченные изменения.
> Пунктиром отмечены контракты и связи, которые существуют в коде,
> но пока подключаются через временные placeholder-адреса.

## Условные обозначения

- Сплошная стрелка — действующая связь в текущем коде.
- Пунктирная стрелка — предусмотренная связь через placeholder или будущую конфигурацию.
- `DOM` — jetton Dominum.
- `ALLOD` — jetton Allodium.
- `TON` — нативная монета сети TON, используемая для газа и резервов.
- Каждый контракт, который хранит DOM, владеет отдельным `DomWallet`.

## 1. Общая карта системы

```mermaid
flowchart TB
    Architect["Владельцы и signer-кошельки"]

    subgraph Management["Контур управления"]
        TreasuryManager["TreasuryManager"]
        MinterManager["MinterManager"]
        GiverManager["GiverManager"]
    end

    subgraph Core["Ядро DOM"]
        Minter["Minter"]
        DomMaster["DomMaster"]
        DomWallet["DomWallet владельца"]
        TreasuryPool["TreasuryPool"]
        GasPool["GasPool"]
    end

    subgraph Distribution["Первичное распределение эмиссии"]
        GiverAllodium["GiverAllodium<br/>25% эмиссии"]
        GiverDefi["GiverDefi<br/>25% эмиссии"]
        GiverDao["GiverDao<br/>25% эмиссии"]
        GiverDominum["GiverDominum<br/>25% эмиссии"]
    end

    subgraph Allodium["Сектор Allodium"]
        FrsAllodium["FrsAllodium"]
        AllodiumFoundation["AllodiumFoundation"]
        AllodMaster["AllodMaster"]
        AllodWallet["AllodWallet"]
        AllodGasPool["AllodGasPool"]
    end

    subgraph Defi["Сектор DeFi"]
        MarketMaker["MarketMaker"]
        FoundryLock["FoundryLock"]
        BankDefi["BankDefi"]
        DefiFoundation["DeFi Foundation<br/>отдельного контракта пока нет"]
    end

    subgraph Dao["Сектор DAO"]
        BankDao["BankDao"]
        DaoFoundation["DaoFoundation"]
    end

    subgraph Dominum["Сектор Dominum"]
        BankDominum["BankDominum"]
        DominumFoundation["DominumFoundation"]
    end

    Architect --> TreasuryManager
    Architect --> MinterManager
    Architect --> GiverManager
    Architect --> Minter

    TreasuryManager -->|"запрос изменения treasury-контура"| TreasuryPool
    MinterManager -->|"замена Minter / MinterManager"| DomMaster
    GiverManager -->|"замена Giver / GiverManager"| DomMaster

    Minter -->|"разрешённый OP_MINT"| DomMaster
    DomMaster -->|"создаёт и обслуживает"| DomWallet

    DomMaster -->|"25% DOM"| GiverAllodium
    DomMaster -->|"25% DOM"| GiverDefi
    DomMaster -->|"25% DOM"| GiverDao
    DomMaster -->|"25% DOM"| GiverDominum

    DomWallet -->|"перевод + комиссия DOM"| TreasuryPool
    TreasuryPool -->|"проверка и исполнение"| GasPool
    GasPool -->|"доставка DOM через TreasuryPool"| DomWallet

    GiverAllodium -. "50% DOM" .-> FrsAllodium
    GiverAllodium -. "50% DOM" .-> AllodiumFoundation

    GiverDefi -. "20% DOM" .-> MarketMaker
    GiverDefi -. "40% DOM" .-> FoundryLock
    GiverDefi -. "40% DOM в defiTreasuryAddress" .-> BankDefi

    GiverDao -. "50% DOM" .-> BankDao
    GiverDao -. "50% DOM" .-> DaoFoundation

    GiverDominum -. "50% DOM" .-> BankDominum
    GiverDominum -. "50% DOM" .-> DominumFoundation

    FrsAllodium -->|"увеличивает allowance"| AllodMaster
    AllodMaster -->|"создаёт и обслуживает"| AllodWallet
    AllodWallet -->|"перевод + комиссия ALLOD"| AllodGasPool
    AllodMaster -->|"burn сообщает об освобождении DOM"| FrsAllodium

    BankDefi -->|"разрешённая цель"| MarketMaker
    BankDefi -. "разрешённая цель" .-> DefiFoundation
    MarketMaker -->|"разрешённая цель"| BankDefi
    MarketMaker -. "разрешённая цель" .-> DefiFoundation

    classDef core fill:#32235f,stroke:#9d7cff,color:#ffffff;
    classDef management fill:#183c63,stroke:#6db8ff,color:#ffffff;
    classDef allodium fill:#173f52,stroke:#67d8ff,color:#ffffff;
    classDef domain fill:#3f2457,stroke:#d48cff,color:#ffffff;
    classDef future fill:#3d3d46,stroke:#a5a5b5,color:#ffffff,stroke-dasharray:5 5;

    class DomMaster,DomWallet,Minter,TreasuryPool,GasPool core;
    class TreasuryManager,MinterManager,GiverManager management;
    class FrsAllodium,AllodiumFoundation,AllodMaster,AllodWallet,AllodGasPool allodium;
    class GiverAllodium,GiverDefi,GiverDao,GiverDominum,MarketMaker,FoundryLock,BankDefi,BankDao,DaoFoundation,BankDominum,DominumFoundation domain;
    class DefiFoundation future;
```

Источники общей карты:

- Роли `DomMaster`: `contracts/Dominum/dom/master.tolk:19-37`.
- Распределение эмиссии по четырём giver: `contracts/Dominum/dom/master.tolk:324-351`.
- Доли `25 / 25 / 25 / 25`: `contracts/Dominum/core/constants.tolk:17-22`.
- Управляющие запросы: `contracts/Dominum/management/treasury_manager.tolk:24-122`,
  `contracts/Dominum/management/minter_manager.tolk:28-126`,
  `contracts/Dominum/management/giver_manager.tolk:24-126`.

## 2. Выпуск DOM

```mermaid
sequenceDiagram
    participant Owner as Minter owner
    participant Minter
    participant Master as DomMaster
    participant GA as GiverAllodium wallet
    participant GD as GiverDefi wallet
    participant GDAO as GiverDao wallet
    participant GDOM as GiverDominum wallet

    Owner->>Minter: OP_MINT(amount)
    Minter->>Master: OP_MINT(amount)
    Master->>Master: Проверка min/max, интервала и MAX_SUPPLY
    Master->>GA: 25% DOM
    Master->>GD: 25% DOM
    Master->>GDAO: 25% DOM
    Master->>GDOM: Остаток, равный 25% DOM
```

`Minter` не выпускает DOM самостоятельно. Он проверяет своего владельца
и отправляет разрешённый `OP_MINT` в `DomMaster`.

Источники:

- `Minter → DomMaster`: `contracts/Dominum/treasury/minter.tolk:27-50`,
  `contracts/Dominum/treasury/minter.tolk:53-90`.
- Проверки и выпуск в `DomMaster`: `contracts/Dominum/dom/master.tolk:285-351`,
  `contracts/Dominum/dom/master.tolk:354-390`.
- Тестовый интервал минта — 3600 секунд:
  `contracts/Dominum/core/constants.tolk:34-38`.

## 3. Автоматическое распределение giver-контрактами

```mermaid
flowchart LR
    Master["DomMaster"]

    GA["GiverAllodium"]
    GDefi["GiverDefi"]
    GDao["GiverDao"]
    GDom["GiverDominum"]

    FRS["FrsAllodium<br/>50%"]
    AF["AllodiumFoundation<br/>50%"]

    MM["MarketMaker<br/>20%"]
    FL["FoundryLock<br/>40%"]
    DT["defiTreasuryAddress<br/>40%"]

    BD["BankDao<br/>50%"]
    DF["DaoFoundation<br/>50%"]

    BDom["BankDominum<br/>50%"]
    DomF["DominumFoundation<br/>50%"]

    Master --> GA
    Master --> GDefi
    Master --> GDao
    Master --> GDom

    GA -.-> FRS
    GA -.-> AF

    GDefi -.-> MM
    GDefi -.-> FL
    GDefi -.-> DT

    GDao -.-> BD
    GDao -.-> DF

    GDom -.-> BDom
    GDom -.-> DomF
```

После получения `OP_TRANSFER_NOTIFICATION` каждый giver автоматически
распределяет DOM. Перед делением удерживается резерв комиссии
`GIVER_MAX_FEE_DOM`.

Источники:

- Allodium `50 / 50`: `contracts/Dominum/givers/giver_allodium.tolk:88-99`.
- DeFi `20 / 40 / 40`: `contracts/Dominum/givers/giver_defi.tolk:95-108`.
- DAO `50 / 50`: `contracts/Dominum/givers/giver_dao.tolk:88-99`.
- Dominum `50 / 50`: `contracts/Dominum/givers/giver_dominum.tolk:88-99`.
- Адрес кошелька giver теперь строится с `treasuryPoolAddress`:
  `contracts/Dominum/givers/giver_allodium.tolk:10-35`,
  `contracts/Dominum/givers/giver_defi.tolk:15-42`,
  `contracts/Dominum/givers/giver_dao.tolk:10-35`,
  `contracts/Dominum/givers/giver_dominum.tolk:10-35`.

## 4. Маршрут обычного перевода DOM

```mermaid
sequenceDiagram
    participant Owner as Владелец
    participant SenderWallet as DomWallet отправителя
    participant Treasury as TreasuryPool
    participant Gas as GasPool
    participant ReceiverWallet as DomWallet получателя

    Owner->>SenderWallet: OP_TRANSFER(amount, recipient, paidFeeDom)
    SenderWallet->>SenderWallet: Резервирует amount + paidFeeDom
    SenderWallet->>Treasury: OP_TREASURY_EXECUTE
    Treasury->>Treasury: Создаёт pending route
    Treasury->>Gas: OP_GAS_POOL_EXECUTE
    Gas->>Gas: Проверяет wallet, fee и TON reserve
    Gas->>Treasury: OP_TREASURY_DELIVER для получателя
    Treasury->>ReceiverWallet: OP_INTERNAL_TRANSFER amount
    Gas->>Treasury: OP_TREASURY_DELIVER комиссии
    Treasury->>Gas: Комиссия DOM на wallet GasPool
    Gas->>Treasury: OP_TREASURY_SETTLE(success)
    Treasury->>SenderWallet: OP_TREASURY_SETTLE
    SenderWallet->>SenderWallet: Закрывает pending transfer
```

Если операция отклонена или сообщение bounce-ится, pending-перевод
в `DomWallet` восстанавливается.

Источники:

- Начало перевода и резерв баланса:
  `contracts/Dominum/dom/wallet.tolk:278-323`.
- Маршрутизация через `TreasuryPool`:
  `contracts/Dominum/treasury/treasury_pool.tolk:470-558`,
  `contracts/Dominum/treasury/treasury_pool.tolk:561-606`.
- Проверка и выполнение в `GasPool`:
  `contracts/Dominum/pools/gas_pool.tolk:101-158`,
  `contracts/Dominum/pools/gas_pool.tolk:208-266`.
- Обработка успешного и неуспешного завершения:
  `contracts/Dominum/dom/wallet.tolk:195-259`.

### Текущая газовая топология

`GasRouter` удалён из текущего рабочего дерева. Постоянной точкой входа
для DOM-кошельков является `TreasuryPool`, который хранит изменяемый
`gasPoolAddress` и напрямую передаёт выполнение в `GasPool`.

Источники:

- Прямой маршрут `TreasuryPool → GasPool`:
  `contracts/Dominum/treasury/treasury_pool.tolk:487-505`.
- Создание связки `TreasuryPool ↔ GasPool`:
  `scripts/Dominum/foundation/deployInfrastructure.ts:59-139`.

## 5. Экономический цикл Allodium

```mermaid
flowchart LR
    GA["GiverAllodium"]
    FRS["FrsAllodium"]
    AF["AllodiumFoundation"]
    AM["AllodMaster"]
    AW["AllodWallet"]
    AGP["AllodGasPool"]

    GA -. "50% DOM" .-> FRS
    GA -. "50% DOM" .-> AF

    FRS -->|"блокирует DOM"| FRS
    FRS -->|"OP_INCREASE_MINT_ALLOWANCE"| AM
    AM -->|"mint ALLOD в пределах allowance"| AW
    AW -->|"перевод ALLOD + fee"| AGP
    AW -->|"burn"| AM
    AM -->|"OP_ALLOD_BURNED"| FRS
    FRS -->|"разблокирует соответствующий DOM"| FRS
```

`FrsAllodium` является резервным контуром:

1. Получает и блокирует DOM.
2. Увеличивает лимит выпуска ALLOD.
3. После burn ALLOD уменьшает резерв и возвращает соответствующий DOM.

Курс в текущих константах: `100 DOM → 100 ALLOD`, то есть базовое
соотношение после учёта `EXCHANGE_DECIMALS_FACTOR` равно `1 : 1`.

Источники:

- Приём DOM и выдача allowance:
  `contracts/Allodium/treasury/frs_allodium.tolk:103-143`.
- Burn ALLOD и разблокировка DOM:
  `contracts/Allodium/treasury/frs_allodium.tolk:147-168`.
- Ограниченный allowance mint:
  `contracts/Allodium/allod/master.tolk:166-217`.
- Уведомление FRS после burn:
  `contracts/Allodium/allod/master.tolk:221-257`.
- Курс: `contracts/Allodium/core/constants.tolk:11-14`.

## 6. Реестр контрактов

| Домен | Контракт | Файл | Назначение |
|---|---|---|---|
| DOM | DomMaster | `contracts/Dominum/dom/master.tolk:14-37` | Эмиссия DOM, роли minter/giver и код кошелька |
| DOM | DomWallet | `contracts/Dominum/dom/wallet.tolk:19-26` | Баланс DOM и pending-переводы |
| Treasury | Minter | `contracts/Dominum/treasury/minter.tolk:5-9` | Разрешённый вход для минта |
| Treasury | TreasuryPool | `contracts/Dominum/treasury/treasury_pool.tolk:15-38` | Маршрутизация переводов, treasury и gas-конфигурация |
| Management | MinterManager | `contracts/Dominum/management/minter_manager.tolk:5-8` | Запрос замены Minter и самого manager |
| Management | GiverManager | `contracts/Dominum/management/giver_manager.tolk:5-24` | Запрос замены giver и самого manager |
| Management | TreasuryManager | `contracts/Dominum/management/treasury_manager.tolk:5-24` | Запрос изменения treasury-адресов и налога |
| Gas | GasPool | `contracts/Dominum/pools/gas_pool.tolk:5-14` | Проверка комиссии и оплата TON выполнения |
| Distribution | GiverAllodium | `contracts/Dominum/givers/giver_allodium.tolk:10-15` | Делит сектор Allodium между FRS и foundation |
| Distribution | GiverDefi | `contracts/Dominum/givers/giver_defi.tolk:15-21` | Делит сектор DeFi между market, foundry и treasury |
| Distribution | GiverDao | `contracts/Dominum/givers/giver_dao.tolk:10-15` | Делит сектор DAO между bank и foundation |
| Distribution | GiverDominum | `contracts/Dominum/givers/giver_dominum.tolk:10-15` | Делит сектор Dominum между bank и foundation |
| DAO | BankDao | `contracts/Dominum/banks/bank_dao.tolk:24-31` | Управляемое хранилище DOM/TON с whitelist |
| DAO | DaoFoundation | `contracts/Dominum/foundation/dao_foundation.tolk:28-35` | Фонд DAO с whitelist |
| DeFi | BankDefi | `contracts/Dominum/banks/bank_defi.tolk:22-31` | Банк DeFi, связанный с MarketMaker и foundation |
| DeFi | MarketMaker | `contracts/Dominum/defi/market_maker.tolk:11-18` | Операционный контракт рынка |
| DeFi | FoundryLock | `contracts/Dominum/invest/foundry_lock.tolk:18-28` | Помесячная блокировка DOM |
| Dominum | BankDominum | `contracts/Dominum/banks/bank_dominum.tolk:15-19` | Банк Dominum и резерв GasPool |
| Dominum | DominumFoundation | `contracts/Dominum/foundation/dominum_foundation.tolk:23-30` | Фонд Dominum с whitelist |
| Allodium | FrsAllodium | `contracts/Allodium/treasury/frs_allodium.tolk:13-18` | DOM-резерв и allowance для ALLOD |
| Allodium | AllodMaster | `contracts/Allodium/allod/master.tolk:16-25` | Эмиссия ALLOD в пределах allowance |
| Allodium | AllodWallet | `contracts/Allodium/allod/wallet.tolk:21-28` | Баланс и переводы ALLOD |
| Allodium | AllodGasPool | `contracts/Allodium/pools/allod_gas_pool.tolk:5-14` | Газовый контур переводов ALLOD |
| Allodium | AllodiumFoundation | `contracts/Allodium/foundation/foundation.tolk:15-20` | Фонд Allodium с whitelist |

## 7. Что уже входит в основной deploy-граф

Текущий основной DOM compile/deploy-граф включает:

- `DomMaster` и код `DomWallet`;
- `TreasuryManager`, `TreasuryPool`;
- `GasPool`;
- `Minter`, `MinterManager`;
- `GiverManager`;
- четыре giver-контракта.

Источник: `scripts/Dominum/dom/compileContracts.ts:8-50`.

Остальные доменные контракты существуют, имеют wrappers и тесты,
но пока не входят в этот compile/deploy-граф:

- `BankDao`, `BankDefi`, `BankDominum`;
- `DaoFoundation`, `DominumFoundation`, `AllodiumFoundation`;
- `MarketMaker`, `FoundryLock`;
- `FrsAllodium`, `AllodMaster`, `AllodWallet`, `AllodGasPool`.

## 8. Текущие незавершённые соединения

### 8.1 Получатели giver пока задаются placeholder-адресами

В основном deploy-сценарии giver-контракты получают временные адреса:

- `GiverAllodium`: `scripts/Dominum/givers/deployGivers.ts:45-53`.
- `GiverDefi`: `scripts/Dominum/givers/deployGivers.ts:68-77`.
- `GiverDao`: `scripts/Dominum/givers/deployGivers.ts:92-100`.
- `GiverDominum`: `scripts/Dominum/givers/deployGivers.ts:115-123`.

При этом адреса получателей сохраняются в storage giver-контрактов
и сейчас не имеют операции замены:

- `contracts/Dominum/givers/giver_allodium.tolk:5-27`.
- `contracts/Dominum/givers/giver_defi.tolk:5-34`.
- `contracts/Dominum/givers/giver_dao.tolk:5-27`.
- `contracts/Dominum/givers/giver_dominum.tolk:5-27`.

Следствие: до production-deploy необходимо либо передавать реальные
адреса при создании giver, либо заранее добавить безопасный управляемый
механизм их замены. Иначе первая эмиссия отправит DOM на placeholder-цели.

### 8.2 Отдельного DeFi Foundation пока нет

`BankDefi` и `MarketMaker` хранят `defiFoundationAddress`, но отдельного
контракта DeFi Foundation в текущем дереве нет:

- `contracts/Dominum/banks/bank_defi.tolk:22-31`.
- `contracts/Dominum/defi/market_maker.tolk:11-18`.
- Список существующих foundation:
  `contracts/Dominum/foundation/dao_foundation.tolk:1`,
  `contracts/Dominum/foundation/dominum_foundation.tolk:1`,
  `contracts/Allodium/foundation/foundation.tolk:1`.

### 8.3 Treasury-цели тоже начинают с placeholder

`TreasuryPool` создаётся с временными адресами трёх банков и `GasPool`,
но этот контур уже предусматривает замену через:

`TreasuryManager → TreasuryPool request → подтверждение владельцем TreasuryPool`.

Источники:

- Placeholder при deploy:
  `scripts/Dominum/foundation/deployInfrastructure.ts:61-78`.
- Запрос от manager:
  `contracts/Dominum/management/treasury_manager.tolk:24-70`.
- Подтверждение и применение:
  `contracts/Dominum/treasury/treasury_pool.tolk:199-310`,
  `contracts/Dominum/treasury/treasury_pool.tolk:476-537`.

### 8.4 Удаление GasRouter ещё не завершено в тестовом слое

Контракт, wrapper и compile-точка `GasRouter` удалены из рабочего дерева,
но часть sandbox-тестов пока продолжает импортировать wrapper или передавать
старое поле `gasRouterAddress`.

Примеры:

- `tests/Dominum/pools/gas-pool.sandbox.test.ts:13-115`.
- `tests/Dominum/givers/giver-allodium.sandbox.test.ts:28-91`.
- `tests/Dominum/management/minter-manager.sandbox.test.ts:37-92`.

Это не часть целевой схемы контрактов, а незавершённый участок текущего
рефакторинга тестов.

## 9. Главный архитектурный вывод

Система уже разделена на самостоятельные уровни:

1. `Managers` формируют запросы на изменение критических ролей.
2. `Master` контролирует эмиссию и первичное распределение.
3. `Givers` автоматически разделяют четыре экономических сектора.
4. `TreasuryPool` и `GasPool` обеспечивают оплачиваемые DOM-переводы.
5. `Banks`, `Foundations`, `MarketMaker` и `FoundryLock` формируют
   прикладной финансовый уровень.
6. `FrsAllodium` связывает резерв DOM с контролируемой эмиссией ALLOD.

Главный незакрытый участок — не создание новых контрактов, а безопасное
соединение уже существующих доменных контрактов реальными адресами
до первой production-эмиссии.
