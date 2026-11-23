/*
 * Etiquetas ChatClinic — script que roda dentro do app.chatclinic.com.br
 *
 * O que faz:
 *  - No topo do chat aberto (perto do nome e do PROTOCOLO) coloca o botão
 *    "🏷 Etiquetas" e as etiquetas já marcadas na conversa.
 *  - Na lista de conversas (lado esquerdo) mostra as etiquetas ao lado do nome.
 *  - Clicar no botão ou em uma etiqueta abre a caixinha para marcar/desmarcar.
 *
 * As etiquetas são guardadas por NOME do contato, só neste navegador
 * (chrome.storage.local).
 *
 * Se o ChatClinic mudar o layout, os pontos de ajuste estão em CONFIG.
 */
(() => {
  'use strict';

  const CONFIG = {
    // Texto que aparece no cabeçalho do chat aberto, logo abaixo do nome.
    headerMarker: /^\s*PROTOCOLO\b/i,
    // Até quantos níveis subir a partir do "PROTOCOLO" procurando o nome.
    headerMaxDepth: 6,
    // A lista de conversas fica na parte esquerda da tela (fração da largura).
    listMaxLeft: 0.5
  };

  const MARK = 'data-etq';
  // Identidade desta cópia do script. Ao recarregar a extensão com o ChatClinic aberto, a cópia antiga
  // fica "órfã" (runtime.id some) mas continuaria observando a página; as faixas dela têm cliques que
  // não funcionam mais. A cópia nova refaz as faixas que não são dela, e a antiga para.
  const INST = Math.random().toString(36).slice(2);
  const RT = chrome.runtime;
  const alive = () => { try { return !!(RT && RT.id); } catch (e) { return false; } };
  let library = [];
  let assignments = {};
  let observer = null;
  let timer = null;
  let pop = null; // { host, root, key, anchor }

  // ---------- utilidades ----------
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const isOurs = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest('[' + MARK + ']'));
  };
  function textColor(hex) {
    const h = (hex || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1f2937' : '#ffffff';
  }
  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function tagsFor(key) {
    return (assignments[key] || [])
      .map((a) => ({ a, t: library.find((t) => t.id === a.id) }))
      .filter((x) => x.t);
  }

  // ---------- armazenamento ----------
  function load() {
    chrome.storage.local.get(['library', 'assignments'], (d) => {
      library = Array.isArray(d.library) ? d.library : [];
      assignments = d.assignments && typeof d.assignments === 'object' ? d.assignments : {};
      schedule();
      if (pop) renderPopover();
    });
  }
  function toggleTag(key, id) {
    const list = assignments[key] ? assignments[key].slice() : [];
    const i = list.findIndex((a) => a.id === id);
    if (i >= 0) list.splice(i, 1);
    else list.push({ id, at: Date.now() });
    const next = Object.assign({}, assignments);
    if (list.length) next[key] = list;
    else delete next[key];
    assignments = next;
    chrome.storage.local.set({ assignments: next });
    schedule();
    renderPopover();
  }

  // ---------- localizar elementos do ChatClinic ----------
  function firstNameText(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const v = norm(n.nodeValue);
      if (!v || isOurs(n)) continue;
      const tag = n.parentElement && n.parentElement.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      if (CONFIG.headerMarker.test(v)) continue;
      if (/^[\d\s.\-\/:#]+$/.test(v)) continue; // números soltos (protocolo, hora)
      return n;
    }
    return null;
  }

  function findHeader() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, marker = null;
    while ((n = w.nextNode())) {
      if (CONFIG.headerMarker.test(n.nodeValue) && !isOurs(n)) { marker = n; break; }
    }
    if (!marker) return null;
    let el = marker.parentElement;
    for (let i = 0; i < CONFIG.headerMaxDepth && el && el !== document.body; i++) {
      const t = firstNameText(el);
      if (t) return { container: el, nameEl: t.parentElement, name: norm(t.nodeValue) };
      el = el.parentElement;
    }
    return null;
  }

  function findListNames(names, headerContainer) {
    const out = [];
    if (!names.size) return out;
    const maxLeft = window.innerWidth * CONFIG.listMaxLeft;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const v = norm(n.nodeValue);
      if (!v || !names.has(v) || isOurs(n)) continue;
      const el = n.parentElement;
      if (!el || (headerContainer && headerContainer.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || r.left > maxLeft) continue;
      // Se o nome está numa linha "nome ... horário" (flex em linha), a etiqueta
      // vai numa linha própria logo abaixo, para não espremer o nome.
      const parent = el.parentElement;
      const cs = parent && getComputedStyle(parent);
      const ownLine = !!(cs && cs.display.includes('flex') && !cs.flexDirection.startsWith('column') && parent.children.length > 1);
      out.push({ el: ownLine ? parent : el, key: v, ownLine });
    }
    return out;
  }

  // ---------- desenhar etiquetas na página ----------
  function chip(t, a, small) {
    const b = document.createElement('span');
    b.textContent = t.name;
    b.title = a && a.at ? `${t.name} — marcada em ${fmtDate(a.at)}` : t.name;
    b.style.cssText =
      `display:inline-block;background:${t.color};color:${textColor(t.color)};` +
      `font:600 ${small ? 10 : 11}px/1.25 Arial,Helvetica,sans-serif;padding:2px 7px;` +
      'border-radius:10px;white-space:nowrap;cursor:pointer;';
    return b;
  }

  function buildStrip(key, kind, sig) {
    const s = document.createElement('span');
    s.setAttribute(MARK, 'strip');
    s.setAttribute('data-etq-sig', sig);
    s.style.cssText =
      'display:inline-flex;gap:3px;align-items:center;margin:0 0 0 6px;vertical-align:middle;line-height:1;' +
      (kind === 'list'
        ? 'flex:0 100 auto;min-width:0;overflow:hidden;flex-wrap:nowrap;margin-right:6px;' // ao lado do nome, encolhe antes dele
        : kind === 'listline'
          ? 'display:flex;flex-wrap:wrap;margin:3px 0 2px 0;' // linha própria abaixo do nome
          : 'flex-wrap:wrap;');
    const tags = tagsFor(key);
    for (const { a, t } of tags) s.appendChild(chip(t, a, kind !== 'header'));
    if (kind === 'header') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = tags.length ? '🏷 +' : '🏷 Etiquetas';
      btn.title = 'Marcar etiquetas nesta conversa';
      btn.style.cssText =
        'all:unset;cursor:pointer;font:600 11px/1.25 Arial,Helvetica,sans-serif;color:#5b21b6;' +
        'background:#ede9fe;border:1px solid #c4b5fd;border-radius:10px;padding:2px 8px;white-space:nowrap;';
      s.appendChild(btn);
    }
    const open = (e) => { e.preventDefault(); e.stopPropagation(); openPopover(key, s); };
    s.addEventListener('click', open);
    s.addEventListener('mousedown', (e) => e.stopPropagation());
    return s;
  }

  function render() {
    timer = null;
    if (!alive()) { if (observer) observer.disconnect(); observer = null; return; }
    if (!document.body) return;
    const wanted = [];
    const header = findHeader();
    if (header) wanted.push({ anchor: header.nameEl, key: header.name, kind: 'header' });

    const names = new Set(Object.keys(assignments).filter((k) => tagsFor(k).length));
    for (const it of findListNames(names, header && header.container)) {
      wanted.push({ anchor: it.el, key: it.key, kind: it.ownLine ? 'listline' : 'list' });
    }

    const keep = new Set();
    for (const w of wanted) {
      const tags = tagsFor(w.key);
      const sig = INST + '|' + w.kind + '|' + w.key + '|' + tags.map((x) => x.t.id + ':' + x.t.name + ':' + x.t.color).join(',');
      const next = w.anchor.nextSibling;
      const nextIsOurs = next && next.nodeType === 1 && next.getAttribute(MARK) === 'strip';
      if (nextIsOurs && next.getAttribute('data-etq-sig') === sig) { keep.add(next); continue; }
      if (nextIsOurs) next.remove();
      if (w.kind !== 'header' && !tags.length) continue;
      const strip = buildStrip(w.key, w.kind, sig);
      w.anchor.after(strip);
      keep.add(strip);
    }
    document.querySelectorAll('[' + MARK + '="strip"]').forEach((s) => { if (!keep.has(s)) s.remove(); });
    if (observer) observer.takeRecords(); // ignora as mudanças que nós mesmos fizemos
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(render, 200);
  }

  // ---------- caixinha para marcar etiquetas ----------
  const POP_CSS = `
    :host { all: initial; }
    .box { position: fixed; width: 270px; max-height: 360px; overflow: auto; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.18);
      font: 13px/1.4 Arial, Helvetica, sans-serif; color: #1f2937; padding: 12px; box-sizing: border-box; }
    .title { font-weight: 700; font-size: 13px; margin: 0 0 2px; }
    .sub { color: #6b7280; font-size: 11px; margin: 0 0 10px; word-break: break-word; }
    .row { display: flex; align-items: center; gap: 8px; padding: 6px 6px; border-radius: 8px; cursor: pointer; user-select: none; }
    .row:hover { background: #f3f4f6; }
    .check { width: 16px; height: 16px; border-radius: 4px; border: 2px solid #9ca3af; display: grid; place-items: center;
      font-size: 11px; color: #fff; flex: none; box-sizing: border-box; }
    .row.on .check { border-color: transparent; }
    .chip { padding: 2px 9px; border-radius: 10px; font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .when { margin-left: auto; color: #9ca3af; font-size: 10px; white-space: nowrap; }
    .empty { color: #6b7280; font-size: 12px; padding: 6px 2px; }
    .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
    button { all: unset; cursor: pointer; font: 600 12px Arial, Helvetica, sans-serif; color: #6d28d9; padding: 4px 6px; border-radius: 6px; }
    button:hover { background: #f5f3ff; }
    .close { color: #6b7280; }
  `;

  function openPopover(key, anchor) {
    closePopover();
    const host = document.createElement('div');
    host.setAttribute(MARK, 'pop');
    host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    pop = { host, root, key, anchor };
    renderPopover();
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onEsc, true);
    }, 0);
  }

  function closePopover() {
    if (!pop) return;
    pop.host.remove();
    pop = null;
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onEsc, true);
  }
  const onOutside = (e) => { if (pop && !e.composedPath().includes(pop.host)) closePopover(); };
  const onEsc = (e) => { if (e.key === 'Escape') closePopover(); };

  function renderPopover() {
    if (!pop) return;
    const { root, key } = pop;
    root.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = POP_CSS;
    root.appendChild(style);

    const box = document.createElement('div');
    box.className = 'box';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Etiquetas da conversa';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = key;
    box.append(title, sub);

    if (!library.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Nenhuma etiqueta criada ainda. Clique em "Gerenciar etiquetas" para criar.';
      box.appendChild(e);
    }
    const current = assignments[key] || [];
    for (const t of library) {
      const a = current.find((x) => x.id === t.id);
      const row = document.createElement('div');
      row.className = 'row' + (a ? ' on' : '');
      const check = document.createElement('span');
      check.className = 'check';
      if (a) { check.style.background = t.color; check.textContent = '✓'; check.style.color = textColor(t.color); }
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = t.name;
      c.style.background = t.color;
      c.style.color = textColor(t.color);
      row.append(check, c);
      if (a && a.at) {
        const when = document.createElement('span');
        when.className = 'when';
        when.textContent = fmtDate(a.at);
        row.appendChild(when);
      }
      row.addEventListener('click', () => toggleTag(key, t.id));
      box.appendChild(row);
    }

    const foot = document.createElement('div');
    foot.className = 'foot';
    const manage = document.createElement('button');
    manage.textContent = '⚙ Gerenciar etiquetas';
    manage.addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'openManager' }); closePopover(); });
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = 'Fechar';
    close.addEventListener('click', closePopover);
    foot.append(manage, close);
    box.appendChild(foot);
    root.appendChild(box);

    // posiciona perto de onde a pessoa clicou, sem sair da tela
    const r = pop.anchor && pop.anchor.isConnected ? pop.anchor.getBoundingClientRect() : { left: 20, top: 20, bottom: 40 };
    const bw = 270, bh = box.offsetHeight || 200;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - bw - 8);
    let top = r.bottom + 6;
    if (top + bh > window.innerHeight - 8) top = Math.max(8, r.top - bh - 6);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }

  // ---------- início ----------
  function start() {
    load();
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') load(); });
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
