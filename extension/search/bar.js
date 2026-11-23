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
  // API deste script. Quando a extensão é recarregada com o ChatClinic aberto, este script vira "órfão"
  // (runtime.id some) mas continuaria observando a página e brigando com o script novo pela barra.
  const api = globalThis.chrome;
  const alive = () => { try { return !!(api && api.runtime && api.runtime.id); } catch { return false; } };

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
    api.storage.local.get(['library', 'assignments'], (d) => {
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
  // Recolhida = uma linha só de etiquetas; o botão "+N" abre as demais.
  const ROW = 20; // altura de uma linha de botões (px)
  const BAR_CSS = `
    :host { all: initial; display: block; }
    .bar { display: flex; align-items: flex-start; gap: 4px; padding: 5px 8px;
      border-bottom: 1px solid #ede9fe; background: #faf5ff; box-sizing: border-box;
      font: 12px/1.3 Arial, Helvetica, sans-serif; color: #1f2937; }
    .lbl { font-weight: 700; color: #5b21b6; white-space: nowrap; line-height: ${ROW}px; flex: none; }
    .tags { flex: 1 1 auto; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px; }
    .bar:not(.open) .tags { max-height: ${ROW}px; overflow: hidden; }
    .ctrl { flex: none; display: flex; gap: 4px; }
    button { all: unset; cursor: pointer; box-sizing: border-box; white-space: nowrap; height: ${ROW}px;
      font: 600 11px/1.25 Arial, Helvetica, sans-serif; border-radius: 10px; padding: 2px 8px; }
    button:focus-visible { outline: 2px solid #7c3aed; outline-offset: 1px; }
    .tag { border: 1.5px solid var(--c); color: #374151; background: #fff; max-width: 160px;
      overflow: hidden; text-overflow: ellipsis; }
    .tag[aria-pressed="true"] { background: var(--c); color: var(--fg); }
    .more, .mode { color: #5b21b6; background: #ede9fe; border: 1px solid #c4b5fd; }
    .more.sel { background: #7c3aed; border-color: #7c3aed; color: #fff; }
    .more[hidden] { display: none; }
    .clear { color: #5b21b6; padding: 2px 4px; text-decoration: underline; }
    .empty { color: #6b7280; font-size: 11px; padding: 0 8px 4px; background: #faf5ff;
      border-bottom: 1px solid #ede9fe; font-family: Arial, Helvetica, sans-serif; }
  `;
  let open = false; // barra aberta (todas as linhas) ou recolhida (uma linha)

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
    box.className = 'bar' + (open ? ' open' : '');
    box.setAttribute('role', 'toolbar');
    box.setAttribute('aria-label', 'Filtrar conversas por etiqueta');

    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = '🏷 Filtrar:';
    const tags = document.createElement('div');
    tags.className = 'tags';
    const ctrl = document.createElement('div');
    ctrl.className = 'ctrl';
    box.append(lbl, tags, ctrl);

    for (const t of library) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag';
      b.dataset.id = t.id;
      b.textContent = t.name;
      b.title = t.name;
      b.style.setProperty('--c', t.color);
      b.style.setProperty('--fg', textColor(t.color));
      b.setAttribute('aria-pressed', String(selected.includes(t.id)));
      b.addEventListener('click', () => toggle(t.id));
      tags.appendChild(b);
    }

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more';
    more.hidden = true;
    more.addEventListener('click', () => { open = !open; render(); });
    ctrl.appendChild(more);

    if (selected.length >= 2) {
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'mode';
      m.textContent = mode === 'all' ? 'todas' : 'qualquer uma';
      m.title = mode === 'all'
        ? 'Mostrando quem tem TODAS as etiquetas escolhidas. Clique para "qualquer uma".'
        : 'Mostrando quem tem QUALQUER UMA das etiquetas escolhidas. Clique para "todas".';
      m.addEventListener('click', () => { mode = mode === 'all' ? 'any' : 'all'; render(); });
      ctrl.appendChild(m);
    }
    root.append(style, box);
    if (selected.length) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'clear';
      c.textContent = 'limpar';
      c.title = 'Mostrar todas as conversas de novo';
      c.addEventListener('click', () => { selected = []; render(); });
      ctrl.appendChild(c);
      if (!shown) {
        const e = document.createElement('div');
        e.className = 'empty';
        e.textContent = 'Nenhuma conversa carregada na lista tem essa etiqueta.';
        root.appendChild(e);
      }
    }
    updateMore();
  }

  // Conta as etiquetas que não cabem na primeira linha e ajusta o botão "+N" / "menos".
  function updateMore() {
    if (!bar) return;
    const more = bar.root.querySelector('.more');
    const btns = [...bar.root.querySelectorAll('button.tag')];
    if (!more || !btns.length) return;
    // Mede com o "+N" visível, porque ele mesmo ocupa espaço na linha; repete até a conta estabilizar.
    const top = btns[0].offsetTop;
    const count = () => btns.filter((b) => b.offsetTop > top);
    more.hidden = false;
    more.textContent = `+${btns.length} ▾`;
    let extra = count();
    for (let i = 0; i < 3 && !open && extra.length; i++) {
      more.textContent = `+${extra.length} ▾`;
      const again = count();
      if (again.length === extra.length) break;
      extra = again;
    }
    if (!open && !extra.length) { more.hidden = true; return; }
    const hiddenSel = open ? 0 : extra.filter((b) => b.getAttribute('aria-pressed') === 'true').length;
    more.textContent = open ? 'menos ▴' : `+${extra.length} ▾`;
    more.classList.toggle('sel', hiddenSel > 0);
    more.setAttribute('aria-expanded', String(open));
    more.title = open
      ? 'Mostrar só uma linha de etiquetas'
      : `Mostrar mais ${extra.length} etiqueta${extra.length > 1 ? 's' : ''}` +
        (hiddenSel ? ` (${hiddenSel} escolhida${hiddenSel > 1 ? 's' : ''} entre elas)` : '');
  }

  function ensureBar(list) {
    // Barras de outro script (órfão de uma versão anterior) saem; só a nossa fica.
    document.querySelectorAll('[' + MARK + '="search-bar"]').forEach((h) => { if (!bar || h !== bar.host) h.remove(); });
    if (bar && bar.host.isConnected && bar.host.nextElementSibling === list) return;
    if (bar) bar.host.remove();
    const host = document.createElement('div');
    host.setAttribute(MARK, 'search-bar');
    const root = host.attachShadow({ mode: 'open' });
    list.before(host);
    bar = { host, root, sig: null, ro: null };
    // A largura da coluna muda (janela, zoom): recalcula quantas etiquetas cabem.
    if (typeof ResizeObserver === 'function') { bar.ro = new ResizeObserver(updateMore); bar.ro.observe(host); }
  }

  // Script órfão: para de observar e tira a própria barra (o script novo desenha a dele).
  function teardown() {
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(timer);
    window.removeEventListener('resize', updateMore);
    if (bar) { if (bar.ro) bar.ro.disconnect(); bar.host.remove(); bar = null; }
  }

  function render() {
    timer = null;
    if (!alive()) { teardown(); return; }
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
      const sig = JSON.stringify([library, selected, mode, open, shown > 0]);
      if (bar.sig !== sig) { renderBar(shown); bar.sig = sig; }
    }
    if (observer) observer.takeRecords(); // ignora as mudanças que nós mesmos fizemos
  }

  function schedule() {
    if (timer || !observer) return;
    timer = setTimeout(render, 150);
  }

  // O ChatClinic recria a lista inteira quando chega mensagem. Filtrar na hora (antes da tela ser
  // pintada) evita que, com filtro ativo, a lista toda apareça por um instante. Custo: ~1 ms.
  const isItem = (n) => n.nodeType === 1 && (n.matches(CONFIG.item) || !!n.querySelector(CONFIG.item));
  function onMutations(recs) {
    for (const r of recs) {
      for (const n of r.addedNodes) {
        if (isItem(n)) { clearTimeout(timer); render(); return; }
      }
    }
    schedule();
  }

  // ---------- início ----------
  function start() {
    load();
    api.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.library || changes.assignments)) load();
    });
    // childList pega itens novos, troca de aba e paginação; characterData pega nome alterado.
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', updateMore);
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
