import React, { useEffect, useMemo, useState } from "react";

import {
  contractMap,
  contractNodes,
  statusLabels
} from "./data/contracts";

import type {
  ContractLink,
  ContractNode
} from "./types";

const defaultId = contractNodes[0]?.id ?? "";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    text: string
  ) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

function resolveLink(link: ContractLink) {
  const target = link.id ? contractMap[link.id] : undefined;

  return {
    title: target?.title ?? link.title ?? link.id ?? "—",
    path: target?.path ?? link.path ?? "—",
    status: target?.status ?? link.status ?? "external",
    label: link.label ?? ""
  };
}

function NodeButton(props: {
  node: ContractNode;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const className = props.isActive ? "node isActive" : "node";

  return (
    <button
      type="button"
      className={className}
      onClick={() => props.onSelect(props.node.id)}
      aria-pressed={props.isActive}
    >
      <span
        className="nodeStatus"
        data-status={props.node.status}
      />
      <span>{props.node.title}</span>
    </button>
  );
}

function Summary(props: { items?: string[] }) {
  if (!props.items?.length) {
    return null;
  }

  return (
    <>
      {props.items.map((line, index) => (
        <p className="detailsText" key={index}>
          {line}
        </p>
      ))}
    </>
  );
}

function LinkRow(props: { link: ContractLink }) {
  const resolved = resolveLink(props.link);

  return (
    <div className="linkRow">
      <span
        className="nodeStatus"
        data-status={resolved.status}
      />
      <span className="linkName">{resolved.title}</span>
      {resolved.label ? (
        <span className="linkMeta">— {resolved.label}</span>
      ) : null}
      <span className="linkMeta">{resolved.path}</span>
    </div>
  );
}

function buildPseudoCode(node: ContractNode) {
  const lines: string[] = [];

  lines.push(`contract ${node.title}`);
  lines.push(`path: ${node.path}`);
  lines.push("");

  if (node.ops?.length) {
    lines.push("ops:");
    for (const op of node.ops) {
      lines.push(`  - ${op}`);
    }
    lines.push("");
  }

  if (node.summary?.length) {
    lines.push("summary:");
    for (const line of node.summary) {
      lines.push(`  - ${line}`);
    }
    lines.push("");
  }

  if (node.links?.length) {
    lines.push("links:");
    for (const link of node.links) {
      const resolved = resolveLink(link);
      const label = resolved.label ? ` (${resolved.label})` : "";
      lines.push(`  -> ${resolved.title}${label}`);
    }
    lines.push("");
  }

  lines.push("pseudo:");
  lines.push("  onInternalMessage(op) {");
  if (node.ops?.length) {
    lines.push("    switch(op) {");
    for (const op of node.ops) {
      lines.push(`      case ${op}: /* ... */ break;`);
    }
    lines.push("      default: /* ... */");
    lines.push("    }");
  } else {
    lines.push("    /* ... */");
  }
  lines.push("  }");

  return lines.join("\n");
}

function sanitizeMermaidId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_]/g, "_");
}

function buildDependenciesMermaid(
  selected: ContractNode,
  mode: "local" | "all"
) {
  const lines: string[] = [];
  const selectedKey = `n_${sanitizeMermaidId(selected.id)}`;

  lines.push("flowchart LR");
  lines.push("  %% Схема зависимостей (генерируется из tools/contracts-explorer/src/data/contracts.ts)");
  lines.push("  classDef selected fill:#7c5cff,stroke:#b9a8ff,color:#0b0d14,stroke-width:1px;");
  lines.push("  classDef node fill:#101425,stroke:#6a6f93,color:#e8ebff;");
  lines.push("");

  const addNode = (key: string, title: string) => {
    const safeTitle = title.replace(/\"/g, "'");
    lines.push(`  ${key}["${safeTitle}"]:::node`);
  };

  addNode(selectedKey, selected.title);
  lines.push(`  class ${selectedKey} selected;`);
  lines.push("");

  const pushEdge = (
    fromKey: string,
    toKey: string,
    label?: string
  ) => {
    const clean = (label ?? "").trim();
    if (clean) {
      lines.push(`  ${fromKey} -->|"${clean}"| ${toKey}`);
      return;
    }
    lines.push(`  ${fromKey} --> ${toKey}`);
  };

  const outgoing = selected.links ?? [];
  outgoing.forEach((link, index) => {
    const resolved = resolveLink(link);
    const rawId = link.id ?? `ext_out_${index}`;
    const toKey = `n_${sanitizeMermaidId(rawId)}`;

    addNode(toKey, resolved.title);
    pushEdge(selectedKey, toKey, resolved.label);
  });

  const incoming = contractNodes
    .filter((node) => node.id !== selected.id)
    .flatMap((node) => {
      const links = node.links ?? [];
      const hits = links
        .map((link) => ({ node, link }))
        .filter(({ link }) => link.id === selected.id);
      return hits;
    });

  incoming.forEach(({ node, link }) => {
    const fromKey = `n_${sanitizeMermaidId(node.id)}`;
    addNode(fromKey, node.title);
    pushEdge(fromKey, selectedKey, link.label);
  });

  if (mode === "all") {
    lines.push("");
    lines.push("  %% Расширенный режим: добавляем связи соседей (1 шаг)");

    const neighborIds = new Set<string>();
    outgoing.forEach((link) => {
      if (link.id) {
        neighborIds.add(link.id);
      }
    });
    incoming.forEach(({ node }) => neighborIds.add(node.id));

    for (const id of Array.from(neighborIds)) {
      const node = contractMap[id];
      if (!node?.links?.length) {
        continue;
      }

      const fromKey = `n_${sanitizeMermaidId(node.id)}`;
      node.links.forEach((l, index) => {
        const resolved = resolveLink(l);
        const rawId = l.id ?? `ext_all_${node.id}_${index}`;
        const toKey = `n_${sanitizeMermaidId(rawId)}`;
        addNode(toKey, resolved.title);
        pushEdge(fromKey, toKey, resolved.label);
      });
    }
  }

  return lines.join("\n");
}

function DependenciesGraph(props: { node: ContractNode }) {
  const [mode, setMode] = useState<"local" | "all">("local");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  const diagramText = useMemo(() => {
    return buildDependenciesMermaid(props.node, mode);
  }, [props.node, mode]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const mermaid = window.mermaid;
        if (!mermaid) {
          setError("Mermaid не загружен (нет интернета или CDN заблокирован).");
          setSvg("");
          return;
        }

        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          flowchart: { curve: "basis" }
        });

        const result = await mermaid.render(
          `deps_${Date.now()}`,
          diagramText
        );

        if (cancelled) {
          return;
        }

        setError("");
        setSvg(result.svg);
      } catch (e) {
        if (cancelled) {
          return;
        }

        setSvg("");
        setError("Ошибка рендера Mermaid. Проверь данные/связи.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [diagramText]);

  return (
    <div className="graphCard">
      <div className="graphHeader">
        <div className="graphTitle">Схема зависимостей</div>
        <div className="graphControls">
          <button
            type="button"
            className={mode === "local" ? "btn isActive" : "btn"}
            onClick={() => setMode("local")}
          >
            Локально
          </button>
          <button
            type="button"
            className={mode === "all" ? "btn isActive" : "btn"}
            onClick={() => setMode("all")}
          >
            Расширенно
          </button>
        </div>
      </div>

      <div className="graphHint">
        Узел: <code>{props.node.title}</code>
      </div>

      {error ? (
        <div className="graphError">{error}</div>
      ) : (
        <div
          className="graphSvg"
          // Mermaid отдаёт готовый SVG строкой
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}

function Details(props: { node: ContractNode }) {
  const statusText = statusLabels[props.node.status] ?? "—";

  const pseudo = useMemo(() => {
    return buildPseudoCode(props.node);
  }, [props.node]);

  return (
    <div className="detailsCard">
      <div className="detailsTitle">{props.node.title}</div>
      <div className="detailsMeta">
        <span className="badge" data-status={props.node.status}>
          {statusText}
        </span>
        <span className="path">{props.node.path}</span>
      </div>

      <Summary items={props.node.summary} />

      <div className="detailsBlock">
        <div className="detailsLabel">Ключевые операции</div>
        {props.node.ops?.length ? (
          <div className="tagRow">
            {props.node.ops.map((op) => (
              <span className="tag" key={op}>
                {op}
              </span>
            ))}
          </div>
        ) : (
          <div className="empty">Пока не задано</div>
        )}
      </div>

      <div className="detailsBlock">
        <div className="detailsLabel">Связи</div>
        {props.node.links?.length ? (
          <>
            {props.node.links.map((link, index) => (
              <LinkRow link={link} key={index} />
            ))}
          </>
        ) : (
          <div className="empty">Нет связей</div>
        )}
      </div>

      <div className="detailsBlock">
        <div className="detailsLabel">Псевдокод</div>
        <div className="pseudo">{pseudo}</div>
      </div>
    </div>
  );
}

type TreeFolder = {
  kind: "folder";
  key: string;
  name: string;
  children: TreeNode[];
};

type TreeFile = {
  kind: "file";
  key: string;
  nodeId: string;
};

type TreeNode = TreeFolder | TreeFile;

function Tree(props: {
  selectedId: string;
  onSelect: (id: string) => void;
  search: string;
}) {
  const query = props.search.trim().toLowerCase();

  const matches = (node: ContractNode) => {
    if (!query) {
      return true;
    }
    const hay = `${node.title} ${node.path}`.toLowerCase();
    return hay.includes(query);
  };

  const tree = useMemo<TreeFolder>(() => {
    const root: TreeFolder = {
      kind: "folder",
      key: "root",
      name: "root",
      children: []
    };

    const ensureFolder = (
      parent: TreeFolder,
      key: string,
      name: string
    ) => {
      const existing = parent.children.find((child) => {
        return child.kind === "folder" && child.key === key;
      });

      if (existing && existing.kind === "folder") {
        return existing;
      }

      const folder: TreeFolder = {
        kind: "folder",
        key,
        name,
        children: []
      };

      parent.children.push(folder);
      return folder;
    };

    const addFile = (
      parent: TreeFolder,
      key: string,
      nodeId: string
    ) => {
      parent.children.push({
        kind: "file",
        key,
        nodeId
      });
    };

    for (const node of contractNodes) {
      if (!matches(node)) {
        continue;
      }

      const parts = node.path.split("/").filter(Boolean);
      let current = root;

      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const nextKey = `${current.key}/${part}`;

        if (isLast) {
          addFile(current, nextKey, node.id);
          continue;
        }

        current = ensureFolder(current, nextKey, part);
      }
    }

    return root;
  }, [query]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "root/contracts": true,
    "root/contracts/Dominum": true,
    "root/contracts/Allodium": true
  });

  const toggle = (key: string) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.kind === "file") {
      const contract = contractMap[node.nodeId];
      if (!contract) {
        return null;
      }

      return (
        <div
          className="treeRow"
          key={node.key}
          style={{ paddingLeft: depth * 12 }}
        >
          <NodeButton
            node={contract}
            isActive={contract.id === props.selectedId}
            onSelect={props.onSelect}
          />
        </div>
      );
    }

    const isOpen = expanded[node.key] ?? false;

    return (
      <div className="treeFolder" key={node.key}>
        <button
          type="button"
          className="folderRow"
          onClick={() => toggle(node.key)}
          style={{ paddingLeft: depth * 12 }}
        >
          <span className="caret">{isOpen ? "▾" : "▸"}</span>
          <span className="folderName">{node.name}</span>
        </button>
        {isOpen ? (
          <div className="folderChildren">
            {node.children
              .slice()
              .sort((a, b) => {
                if (a.kind !== b.kind) {
                  return a.kind === "folder" ? -1 : 1;
                }
                return a.key.localeCompare(b.key);
              })
              .map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="tree">
      <div className="group">
        <div className="groupHeader">
          <span className="groupTitle">contracts/</span>
          <span className="sectionTitle">
            {query ? "фильтр включён" : "полное дерево"}
          </span>
        </div>
        {tree.children.map((child) => renderNode(child, 0))}
      </div>
    </div>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState(defaultId);
  const [search, setSearch] = useState("");

  const selected = contractMap[selectedId] ?? contractNodes[0];

  return (
    <div className="page">
      <header className="header">
        <div className="titleRow">
          <h1 className="title">Dominum — дерево контрактов</h1>
          <p className="subtitle">
            Папка: <code>tools/contracts-explorer</code>
          </p>
        </div>

        <p className="subtitle">
          Поиск фильтрует дерево. Клик по узлу показывает детали и
          псевдокод справа.
        </p>

        <div className="toolbar">
          <input
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или пути (например: gas_pool)"
          />
          <div className="chip">
            Схемы: <code>tools/contracts/index.html</code>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="graphArea">
          {selected ? (
            <DependenciesGraph node={selected} />
          ) : (
            <div className="graphCard">Нет данных</div>
          )}
        </section>

        <section className="treeArea">
          <Tree
            selectedId={selectedId}
            onSelect={setSelectedId}
            search={search}
          />
        </section>

        <aside className="details">
          {selected ? (
            <Details node={selected} />
          ) : (
            <div className="detailsCard">Нет данных</div>
          )}
        </aside>
      </main>
    </div>
  );
}

