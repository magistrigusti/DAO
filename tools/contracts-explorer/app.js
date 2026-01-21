import React, { useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import htm from "https://esm.sh/htm@3.1.1";
import {
  contractGroups,
  contractNodes,
  contractMap,
  statusLabels,
} from "./data.js";

const html = htm.bind(React.createElement);

const defaultId = contractNodes[0]?.id ?? "";

function NodeButton({ node, isActive, onSelect }) {
  const className = isActive ? "node isActive" : "node";

  return html`
    <button
      type="button"
      className=${className}
      onClick=${() => onSelect(node.id)}
      aria-pressed=${isActive}
    >
      <span
        className="nodeStatus"
        data-status=${node.status}
      ></span>
      <span>${node.title}</span>
    </button>
  `;
}

function Summary({ items }) {
  if (!items?.length) {
    return null;
  }

  return html`
    ${items.map(
      (line, index) => html`
        <p className="detailsText" key=${index}>
          ${line}
        </p>
      `
    )}
  `;
}

function resolveLink(link) {
  const target = link.id ? contractMap[link.id] : null;

  return {
    title: target?.title ?? link.title ?? link.id ?? "—",
    path: target?.path ?? link.path ?? "—",
    status: target?.status ?? link.status ?? "external",
    label: link.label ?? "",
  };
}

function LinkRow({ link }) {
  const resolved = resolveLink(link);

  return html`
    <div className="linkRow">
      <span
        className="nodeStatus"
        data-status=${resolved.status}
      ></span>
      <span className="linkName">${resolved.title}</span>
      ${resolved.label
        ? html`<span className="linkMeta">— ${resolved.label}</span>`
        : null}
      <span className="linkMeta">${resolved.path}</span>
    </div>
  `;
}

function Details({ node }) {
  const statusText = statusLabels[node.status] ?? "—";

  return html`
    <div className="detailsCard">
      <div className="detailsTitle">${node.title}</div>
      <div className="detailsMeta">
        <span className="badge" data-status=${node.status}>
          ${statusText}
        </span>
        <span className="path">${node.path}</span>
      </div>
      <${Summary} items=${node.summary} />

      <div className="detailsBlock">
        <div className="detailsLabel">Ключевые операции</div>
        ${node.ops?.length
          ? html`
              <div className="tagRow">
                ${node.ops.map(
                  (op) => html`<span className="tag" key=${op}>${op}</span>`
                )}
              </div>
            `
          : html`<div className="empty">Пока не задано</div>`}
      </div>

      <div className="detailsBlock">
        <div className="detailsLabel">Связи</div>
        ${node.links?.length
          ? html`
              ${node.links.map(
                (link, index) =>
                  html`<${LinkRow} link=${link} key=${index} />`
              )}
            `
          : html`<div className="empty">Нет связей</div>`}
      </div>
    </div>
  `;
}

function Tree({ selectedId, onSelect }) {
  return html`
    <div className="tree">
      ${contractGroups.map(
        (group) => html`
          <section className="group" key=${group.id}>
            <div className="groupHeader">
              <span className="groupTitle">${group.title}</span>
            </div>
            ${group.sections.map(
              (section) => html`
                <div className="section" key=${section.id}>
                  <div className="sectionTitle">${section.title}</div>
                  <div className="nodeGrid">
                    ${section.nodes.map((nodeId) => {
                      const node = contractMap[nodeId];
                      if (!node) {
                        return null;
                      }

                      return html`
                        <${NodeButton}
                          node=${node}
                          isActive=${node.id === selectedId}
                          onSelect=${onSelect}
                          key=${node.id}
                        />
                      `;
                    })}
                  </div>
                </div>
              `
            )}
          </section>
        `
      )}
    </div>
  `;
}

function App() {
  const [selectedId, setSelectedId] = useState(defaultId);
  const selected = contractMap[selectedId] ?? contractNodes[0];

  return html`
    <div className="page">
      <header className="header">
        <div className="titleRow">
          <h1 className="title">Dominum — обозреватель контрактов</h1>
          <p className="subtitle">
            Файл: <code>tools/contracts-explorer/index.html</code>
          </p>
        </div>
        <p className="subtitle">
          Клик по блоку в дереве показывает описание справа.
        </p>
        <div className="chipRow">
          <span className="chip">React через CDN</span>
          <span className="chip">Данные в data.js</span>
          <span className="chip">Центр: дерево, справа: детали</span>
        </div>
      </header>

      <main className="layout">
        <section className="treeArea">
          <${Tree} selectedId=${selectedId} onSelect=${setSelectedId} />
        </section>
        <aside className="details">
          ${selected
            ? html`<${Details} node=${selected} />`
            : html`<div className="detailsCard">Нет данных</div>`}
        </aside>
      </main>
    </div>
  `;
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(html`<${App} />`);
}
