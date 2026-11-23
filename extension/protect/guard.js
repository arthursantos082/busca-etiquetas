/*
 * Proteção contra perda de etiquetas — parte que roda no ChatClinic.
 *
 * - Pede ao background o backup do dia (uma vez por dia, só se houver marcações).
 * - Marca no localStorage da página do ChatClinic que as etiquetas já foram usadas.
 *   Essa marca fica FORA do storage da extensão, então sobrevive quando ele some.
 * - Se a extensão abrir vazia e houver sinal de uso anterior, mostra o aviso "Restaurar backup".
 */
(() => {
  'use strict';
  const P = globalThis.EtqProtect;
  if (!P) return;

  const LIST = 'ul#atendimentos_contatos'; // só age no frame que tem a lista de conversas
  const USED_KEY = 'etq-etiquetas-usadas';
  let banner = null;

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem acesso */ } };
  const send = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r); }); }
    catch { res(null); } // extensão recarregada: este script ficou órfão
  });

  async function check() {
    const d = await chrome.storage.local.get(['library', 'assignments', 'restoreDismissed']);
    const hasData = d.assignments && Object.keys(d.assignments).length > 0;
    if (hasData) lsSet(USED_KEY, P.dayStr(new Date()));
    const wiped = P.looksWiped(d.library, d.assignments);
    if (!wiped) { hideBanner(); return; }
    const info = (await send({ type: 'backupsInfo' })) || { count: 0, latest: null };
    const offer = P.shouldOfferRestore({
      wiped, usedBefore: !!lsGet(USED_KEY), backupCount: info.count, dismissed: !!d.restoreDismissed
    });
    if (offer) showBanner(info.latest); else hideBanner();
  }

  // ---------- aviso ----------
  const CSS = `
    :host { all: initial; }
    .box { position: fixed; top: 12px; left: 12px; z-index: 2147483646; width: 320px; box-sizing: border-box;
      background: #fff; border: 2px solid #dc2626; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2);
      padding: 12px; font: 13px/1.4 Arial, Helvetica, sans-serif; color: #1f2937; }
    .t { font-weight: 700; color: #b91c1c; margin: 0 0 4px; }
    .p { margin: 0 0 8px; font-size: 12px; }
    .f { font-size: 11px; color: #6b7280; word-break: break-all; margin: 0 0 10px; }
    .row { display: flex; gap: 8px; }
    button { all: unset; cursor: pointer; font: 700 12px Arial, Helvetica, sans-serif; border-radius: 8px; padding: 7px 12px; }
    button:focus-visible { outline: 2px solid #7c3aed; outline-offset: 1px; }
    .go { background: #7c3aed; color: #fff; }
    .no { background: #f3f4f6; color: #374151; }
  `;

  function showBanner(latest) {
    if (banner && banner.isConnected) return;
    // Aviso deixado por uma cópia antiga deste script (extensão recarregada com a aba aberta).
    document.querySelectorAll('[data-etq="restore"]').forEach((el) => el.remove());
    banner = document.createElement('div');
    banner.setAttribute('data-etq', 'restore');
    const root = banner.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('role', 'alert');
    const t = document.createElement('p');
    t.className = 't';
    t.textContent = '🏷 Suas etiquetas sumiram deste navegador';
    const p = document.createElement('p');
    p.className = 'p';
    p.textContent = 'A extensão abriu vazia, mas já tinha sido usada aqui. Restaure o backup mais recente.';
    box.append(t, p);
    if (latest) {
      const f = document.createElement('p');
      f.className = 'f';
      f.textContent = 'Último backup automático: ' + latest;
      box.appendChild(f);
    }
    const row = document.createElement('div');
    row.className = 'row';
    const go = document.createElement('button');
    go.className = 'go';
    go.textContent = 'Restaurar backup';
    go.addEventListener('click', () => send({ type: 'openRestore' }));
    const no = document.createElement('button');
    no.className = 'no';
    no.textContent = 'Agora não';
    no.title = 'Não avisar de novo até as etiquetas voltarem a ser usadas';
    no.addEventListener('click', () => { chrome.storage.local.set({ restoreDismissed: true }); hideBanner(); });
    row.append(go, no);
    box.appendChild(row);
    root.append(style, box);
    document.body.appendChild(banner);
  }

  function hideBanner() {
    if (banner) banner.remove();
    banner = null;
  }

  // ---------- início ----------
  function onListReady() {
    send({ type: 'dailyBackup' });
    check();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !(changes.library || changes.assignments || changes.restoreDismissed)) return;
      // Voltou a ter dados (restaurado ou uso normal): libera avisos futuros.
      if (changes.assignments && changes.assignments.newValue && Object.keys(changes.assignments.newValue).length) {
        chrome.storage.local.get('restoreDismissed', (d) => { if (d.restoreDismissed) chrome.storage.local.remove('restoreDismissed'); });
      }
      check();
    });
  }

  // A lista do ChatClinic aparece depois do carregamento; espera até 2 minutos.
  let tries = 0;
  const wait = setInterval(() => {
    if (document.querySelector(LIST)) { clearInterval(wait); onListReady(); }
    else if (++tries > 120) clearInterval(wait);
  }, 1000);
})();
