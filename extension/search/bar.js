/*
 * Busca por Etiquetas — barra de filtro acima da lista de conversas do ChatClinic.
 *
 * - Mostra as etiquetas da biblioteca como botões; escolher uma ou mais
 *   esconde as conversas da lista que não têm a etiqueta.
 *   Com duas ou mais, o modo é "qualquer uma" (padrão) ou "todas".
 * - Só leitura: nunca grava no chrome.storage.
 * - Esconde com uma classe própria (display:none !important), então convive com a
 *   busca nativa "Procure aqui...", que mexe no style dos itens.
 * - A escolha fica só na memória: ao recarregar a página, recomeça limpa.
 *
 * Se o ChatClinic mudar o layout, os pontos de ajuste estão em CONFIG.
 */
(() => {
  'use strict';
  const S = globalThis.EtqSearch;
  if (!S) return;

  const CONFIG = {
    list: 'ul#atendimentos_contatos', // lista de conversas
    item: 'div.conversation', // cada conversa da lista
    title: '.conversation__name--title' // nome do contato dentro do item
  };

  const MARK = 'data-etq'; // o content.js ignora tudo que estiver dentro de [data-etq]
  const HIDE = 'etq-search-hide';

  let library = [];
  let assignments = {};
  let selected = []; // ids das etiquetas escolhidas, na ordem da biblioteca
  let mode = 'any'; // 'any' = qualquer uma, 'all' = todas
  let bar = null; // { host, root }
  let timer = null;
  let observer = null;

  const textColor = (hex) => {
    const h = (hex || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1f2937' : '#ffffff';
  };

  // ---------- dados (só leitura) ----------
  function load() {
    chrome.storage.local.get(['library', 'assignments'], (d) => {
      library = Array.isArray(d.library) ? d.library : [];
      assignments = d.assignments && typeof d.assignments === 'object' ? d.assignments : {};
      selected = S.pruneSelection(selected, library);
      schedule();
    });
  }

  // ---------- filtro ----------
  function ensureStyle() {
    if (document.querySelector('style[' + MARK + '="search-style"]')) return;
    const st = document.createElement('style');
    st.setAttribute(MARK, 'search-style');
    st.textContent = `.${HIDE}{display:none !important;}`;
    (document.head || document.documentElement).appendChild(st);
  }

  function itemKey(item) {
    const t = item.querySelector(CONFIG.title);
    return S.normName(t ? t.textContent : '');
  }

  // Devolve quantos itens ficaram visíveis pelo nosso filtro (ignora a busca nativa).
  function applyFilter(list) {
    const items = [...list.querySelectorAll(CONFIG.item)];
    const show = S.visibility(items.map(itemKey), { assignments, library, selected, mode });
    let shown = 0;
    items.forEach((it, i) => {
      it.classList.toggle(HIDE, !show[i]);
      if (show[i]) shown++;
    });
    return shown;
  }

  // ---------- barra ----------
  const BAR_CSS = `
    :host { all: initial; display: block; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 6px 8px;
      border-bottom: 1px solid #ede9fe; background: #faf5ff; box-sizing: border-box;
      font: 12px/1.3 Arial, Helvetica, sans-serif; color: #1f2937; }
    .lbl { font-weight: 700; color: #5b21b6; margin-right: 2px; white-space: nowrap; }
    button { all: unset; cursor: pointer; box-sizing: border-box; white-space: nowrap;
      font: 600 11px/1.25 Arial, Helvetica, sans-serif; border-radius: 10px; padding: 2px 8px; }
    button:focus-visible { outline: 2px solid #7c3aed; outline-offset: 1px; }
    .tag { border: 1.5px solid var(--c); color: var(--c); background: #fff; }
    .tag[aria-pressed="true"] { background: var(--c); color: var(--fg); }
    .mode, .clear { color: #5b21b6; background: #ede9fe; border: 1px solid #c4b5fd; }
    .clear { background: transparent; border-color: transparent; text-decoration: underline; }
    .empty { flex-basis: 100%; color: #6b7280; font-size: 11px; padding-top: 2px; }
  `;

  function toggle(id) {
    const on = new Set(selected);
    if (on.has(id)) on.delete(id); else on.add(id);
    selected = library.map((t) => t.id).filter((x) => on.has(x));
    render();
  }

  function renderBar(shown) {
    const { root } = bar;
    root.textContent = '';
    const style = document.createElement('style');
    style.textContent = BAR_CSS;
    const box = document.createElement('div');
    box.className = 'bar';
    box.setAttribute('role', 'toolbar');
    box.setAttribute('aria-label', 'Filtrar conversas por etiqueta');

    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = '🏷 Filtrar:';
    box.appendChild(lbl);

    for (const t of library) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag';
      b.dataset.id = t.id;
      b.textContent = t.name;
      b.style.setProperty('--c', t.color);
      b.style.setProperty('--fg', textColor(t.color));
      b.setAttribute('aria-pressed', String(selected.includes(t.id)));
      b.addEventListener('click', () => toggle(t.id));
      box.appendChild(b);
    }

    if (selected.length >= 2) {
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'mode';
      m.textContent = mode === 'all' ? 'todas' : 'qualquer uma';
      m.title = mode === 'all'
        ? 'Mostrando quem tem TODAS as etiquetas escolhidas. Clique para "qualquer uma".'
        : 'Mostrando quem tem QUALQUER UMA das etiquetas escolhidas. Clique para "todas".';
      m.addEventListener('click', () => { mode = mode === 'all' ? 'any' : 'all'; render(); });
      box.appendChild(m);
    }
    if (selected.length) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'clear';
      c.textContent = 'limpar';
      c.title = 'Mostrar todas as conversas de novo';
      c.addEventListener('click', () => { selected = []; render(); });
      box.appendChild(c);
      if (!shown) {
        const e = document.createElement('div');
        e.className = 'empty';
        e.textContent = 'Nenhuma conversa carregada na lista tem essa etiqueta.';
        box.appendChild(e);
      }
    }
    root.append(style, box);
  }

  function ensureBar(list) {
    if (bar && bar.host.isConnected && bar.host.nextElementSibling === list) return;
    if (bar) bar.host.remove();
    const host = document.createElement('div');
    host.setAttribute(MARK, 'search-bar');
    const root = host.attachShadow({ mode: 'open' });
    list.before(host);
    bar = { host, root, sig: null };
  }

  function render() {
    timer = null;
    const list = document.querySelector(CONFIG.list);
    if (!list) return;
    ensureStyle();
    if (!library.length) {
      if (bar) { bar.host.remove(); bar = null; }
      applyFilter(list);
    } else {
      ensureBar(list);
      const shown = applyFilter(list);
      // Só redesenha a barra se algo nela mudou (preserva o foco do teclado).
      const sig = JSON.stringify([library, selected, mode, shown > 0]);
      if (bar.sig !== sig) { renderBar(shown); bar.sig = sig; }
    }
    if (observer) observer.takeRecords(); // ignora as mudanças que nós mesmos fizemos
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(render, 150);
  }

  // ---------- início ----------
  function start() {
    load();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.library || changes.assignments)) load();
    });
    // childList pega itens novos, troca de aba e paginação; characterData pega nome alterado.
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
