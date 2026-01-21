import type {
  ContractGroup,
  ContractNode,
  ContractStatus
} from "../types";

export const statusLabels: Record<ContractStatus, string> = {
  ok: "готово",
  wip: "в работе",
  draft: "набросок",
  external: "вне репо"
};

export const contractNodes: ContractNode[] = [
  {
    id: "minter_dom",
    title: "minter_dom",
    path: "contracts/Dominum/management/minter_dom.tolk",
    status: "ok",
    summary: [
      "Точка входа минта DOM.",
      "Проверяет администра и отправляет OP_MINT в master."
    ],
    ops: ["OP_MINT"],
    links: [{ id: "master", label: "минт" }]
  },
  {
    id: "master",
    title: "master",
    path: "contracts/Dominum/dom/master.tolk",
    status: "ok",
    summary: [
      "Jetton Master, распределяет минт по гиверам.",
      "Создаёт кошельки и шлёт OP_INTERNAL_TRANSFER."
    ],
    ops: ["OP_INTERNAL_TRANSFER"],
    links: [
      { id: "wallet", label: "Jetton Wallet код" },
      { id: "giver_allodium", label: "минт" },
      { id: "giver_dao", label: "минт" },
      { id: "giver_dom", label: "минт" }
    ]
  },
  {
    id: "wallet",
    title: "wallet",
    path: "contracts/Dominum/dom/wallet.tolk",
    status: "wip",
    summary: [
      "Jetton Wallet. Отправляет нотификации гиверам.",
      "Также участвует в налоговой логике."
    ],
    ops: ["OP_TRANSFER_NOTIFICATION", "OP_RECEIVE_TAX"],
    links: [
      { id: "giver_allodium", label: "уведомление" },
      { id: "giver_dao", label: "уведомление" },
      { id: "giver_dom", label: "уведомление" },
      { id: "dom_treasury", label: "налог" },
      { id: "dao_treasury", label: "налог" },
      { id: "gas_pool", label: "компенсация газа" }
    ]
  },
  {
    id: "giver_allodium",
    title: "giver_allodium",
    path: "contracts/Dominum/givers/giver_allodium.tolk",
    status: "ok",
    summary: [
      "Гивер для Allodium.",
      "Автораспределение 50/50 по whitelist."
    ],
    ops: ["OP_TRANSFER_NOTIFICATION"],
    links: [
      { id: "frs_allodium", label: "50%" },
      { id: "allodium_foundation", label: "50%" },
      { id: "giver_manager", label: "управление whitelist" }
    ]
  },
  {
    id: "giver_dao",
    title: "giver_dao",
    path: "contracts/Dominum/givers/giver_dao.tolk",
    status: "ok",
    summary: ["Гивер для DAO, автораспределение 50/50 по whitelist."],
    ops: ["OP_TRANSFER_NOTIFICATION"],
    links: [
      { id: "bank_dao", label: "50%" },
      { id: "dao_foundation", label: "50%" },
      { id: "giver_manager", label: "управление whitelist" }
    ]
  },
  {
    id: "giver_dom",
    title: "giver_dom",
    path: "contracts/Dominum/givers/giver_dom.tolk",
    status: "ok",
    summary: ["Гивер Dominum, делит поток 50/50 по whitelist."],
    ops: ["OP_TRANSFER_NOTIFICATION"],
    links: [
      { id: "bank_dominum", label: "50%" },
      {
        title: "dual_ownership",
        path: "вне репозитория",
        label: "50%",
        status: "external"
      },
      { id: "giver_manager", label: "управление whitelist" }
    ]
  },
  {
    id: "giver_invest",
    title: "giver_invest",
    path: "contracts/Dominum/givers/giver_invest.tolk",
    status: "wip",
    summary: [
      "Гивер для Invest.",
      "Сейчас файл выглядит незавершённым."
    ],
    ops: ["OP_TRANSFER_NOTIFICATION"],
    links: [
      { id: "giver_manager", label: "управление whitelist" },
      {
        title: "dual_sign",
        path: "вне репозитория",
        label: "двойная подпись",
        status: "external"
      }
    ]
  },
  {
    id: "giver_manager",
    title: "giver_manager",
    path: "contracts/Dominum/management/giver_manager.tolk",
    status: "ok",
    summary: ["Меняет whitelist у гиверов. Админ — сид #2."],
    ops: ["OP_CHANGE_WHITELIST"],
    links: [
      { id: "giver_allodium", label: "whitelist" },
      { id: "giver_dao", label: "whitelist" },
      { id: "giver_dom", label: "whitelist" },
      { id: "giver_invest", label: "whitelist" }
    ]
  },
  {
    id: "treasury_manager",
    title: "treasury_manager",
    path: "contracts/Dominum/management/treasury_manager.tolk",
    status: "ok",
    summary: ["Управляет Gas Pool и казначействами. Админ — Bank Dominum."],
    ops: ["OP_UPDATE_RATE", "OP_WITHDRAW_DOM"],
    links: [{ id: "gas_pool", label: "управление" }]
  },
  {
    id: "dom_treasury",
    title: "dom_treasury",
    path: "contracts/Dominum/treasury/dom_treasury.tolk",
    status: "ok",
    summary: [
      "Казначейство DOM.",
      "Принимает половину комиссии."
    ],
    ops: ["OP_RECEIVE_TAX"]
  },
  {
    id: "dao_treasury",
    title: "dao_treasury",
    path: "contracts/Dominum/treasury/dao_treasury.tolk",
    status: "ok",
    summary: [
      "Казначейство DAO.",
      "Принимает половину комиссии."
    ],
    ops: ["OP_RECEIVE_TAX"]
  },
  {
    id: "gas_pool",
    title: "gas_pool",
    path: "contracts/Dominum/treasury/gas_pool.tolk",
    status: "ok",
    summary: [
      "Компенсация газа: получает DOM и возвращает TON.",
      "Управляется через treasury_manager."
    ],
    ops: ["OP_UPDATE_RATE", "OP_WITHDRAW_DOM", "OP_TRANSFER_NOTIFICATION"],
    links: [{ id: "treasury_manager", label: "управление" }]
  },
  {
    id: "bank_dao",
    title: "bank_dao",
    path: "contracts/Dominum/dao/bank_dao.tolk",
    status: "ok",
    summary: [
      "Банк DAO, принимает поток от giver_dao.",
      "Логика облигаций / NFT."
    ]
  },
  {
    id: "bank_dominum",
    title: "bank_dominum",
    path: "contracts/Dominum/dominum/bank_dominum.tolk",
    status: "draft",
    summary: ["Банк Dominum (пока заглушка/заготовка)."],
    links: [{ id: "treasury_manager", label: "админ" }]
  },
  {
    id: "dao_foundation",
    title: "dao_foundation",
    path: "contracts/Dominum/dao/dao_foundation.tolk",
    status: "ok",
    summary: [
      "Фонд DAO, принимает половину потока от giver_dao."
    ]
  },
  {
    id: "dominum_constants",
    title: "constants",
    path: "contracts/Dominum/core/constants.tolk",
    status: "ok",
    summary: ["Константы Dominum: MAX_SUPPLY, TAX и т.д."]
  },
  {
    id: "dominum_errors",
    title: "errors",
    path: "contracts/Dominum/core/errors.tolk",
    status: "ok",
    summary: ["Коды ошибок Dominum."]
  },
  {
    id: "dominum_op_codes",
    title: "op_codes",
    path: "contracts/Dominum/core/op_codes.tolk",
    status: "ok",
    summary: ["OP-коды Dominum."]
  },
  {
    id: "allodium_constants",
    title: "constants",
    path: "contracts/Allodium/core/constants.tolk",
    status: "ok",
    summary: ["Константы Allodium."]
  },
  {
    id: "allodium_errors",
    title: "errors",
    path: "contracts/Allodium/core/errors.tolk",
    status: "ok",
    summary: ["Коды ошибок Allodium."]
  },
  {
    id: "allodium_op_codes",
    title: "op_codes",
    path: "contracts/Allodium/core/op_codes.tolk",
    status: "ok",
    summary: ["OP-коды Allodium."]
  },
  {
    id: "frs_allodium",
    title: "frs_allodium",
    path: "contracts/Allodium/bridge/frs_allodium.tolk",
    status: "ok",
    summary: [
      "FRS: мост DOM ↔ ALLOD.",
      "Принимает DOM только от giver_allodium."
    ],
    links: [
      { id: "giver_allodium", label: "источник DOM" },
      {
        title: "ALLOD master",
        path: "вне репозитория",
        label: "mint allowance",
        status: "external"
      },
      { id: "allodium_foundation", label: "unlock DOM" }
    ]
  },
  {
    id: "allodium_foundation",
    title: "foundation",
    path: "contracts/Allodium/foundation/foundation.tolk",
    status: "ok",
    summary: ["Фонд Allodium. Получает поток от giver_allodium."]
  }
];

export const contractMap = Object.fromEntries(
  contractNodes.map((node) => [node.id, node])
);

export const contractGroups: ContractGroup[] = [
  {
    id: "dominum",
    title: "Dominum (DOM)",
    sections: [
      {
        id: "dominum-core",
        title: "core",
        nodes: ["dominum_constants", "dominum_errors", "dominum_op_codes"]
      },
      {
        id: "dominum-dom",
        title: "dom",
        nodes: ["master", "wallet"]
      },
      {
        id: "dominum-givers",
        title: "givers",
        nodes: [
          "giver_allodium",
          "giver_dao",
          "giver_dom",
          "giver_invest"
        ]
      },
      {
        id: "dominum-management",
        title: "management",
        nodes: ["minter_dom", "giver_manager", "treasury_manager"]
      },
      {
        id: "dominum-treasury",
        title: "treasury",
        nodes: ["dom_treasury", "dao_treasury", "gas_pool"]
      },
      {
        id: "dominum-dao",
        title: "dao",
        nodes: ["bank_dao", "dao_foundation"]
      },
      {
        id: "dominum-dominum",
        title: "dominum",
        nodes: ["bank_dominum"]
      }
    ]
  },
  {
    id: "allodium",
    title: "Allodium (ALLOD)",
    sections: [
      {
        id: "allodium-core",
        title: "core",
        nodes: ["allodium_constants", "allodium_errors", "allodium_op_codes"]
      },
      {
        id: "allodium-bridge",
        title: "bridge",
        nodes: ["frs_allodium"]
      },
      {
        id: "allodium-foundation",
        title: "foundation",
        nodes: ["allodium_foundation"]
      }
    ]
  }
];

