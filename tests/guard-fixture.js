/*
 * Ambiente falso para protect/guard.js: chrome.storage (promessa e callback), chrome.runtime.sendMessage
 * e a lista do ChatClinic. Começa como "instalação nova": etiquetas padrão, nenhuma marcação.
 */
(function () {
  'use strict';
  try { localStorage.clear(); } catch { /* file:// sem storage */ }

  const listeners = [];
  const data = {
    library: [{ id: 'retornar-ligacao' }, { id: 'aguardando-contato' }, { id: 'proximo-dia-util' }],
    assignments: {}
  };
  const sent = [];
  let backups = { count: 0, latest: null };
  const pick = (keys) => {
    const ks = keys == null ? Object.keys(data) : [].concat(keys);
    const o = {};
    for (const k of ks) if (k in data) o[k] = JSON.parse(JSON.stringify(data[k]));
    return o;
  };
  const change = (patch, removed = []) => {
    const changes = {};
    for (const k of Object.keys(patch)) { changes[k] = { oldValue: data[k], newValue: patch[k] }; data[k] = patch[k]; }
    for (const k of removed) { if (k in data) { changes[k] = { oldValue: data[k] }; delete data[k]; } }
    if (Object.keys(changes).length) setTimeout(() => listeners.forEach((fn) => fn(changes, 'local')), 0);
  };

  globalThis.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const v = pick(keys);
          if (cb) { setTimeout(() => cb(v), 0); return undefined; }
          return Promise.resolve(v);
        },
        set: (patch) => { change(patch); return Promise.resolve(); },
        remove: (k) => { change({}, [].concat(k)); return Promise.resolve(); }
      },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    },
    runtime: {
      id: 'teste',
      lastError: undefined,
      sendMessage: (msg, cb) => {
        sent.push(msg.type);
        if (cb) setTimeout(() => cb(msg.type === 'backupsInfo' ? backups : undefined), 0);
      }
    }
  };

  globalThis.__gx = {
    data, sent,
    setBackups: (b) => { backups = b; },
    setData: (patch) => change(patch),
    banner: () => document.querySelector('[data-etq="restore"]'),
    btn: (cls) => __gx.banner().shadowRoot.querySelector('button.' + cls),
    wait: (ms = 300) => new Promise((r) => setTimeout(r, ms))
  };

  const ul = document.createElement('ul');
  ul.id = 'atendimentos_contatos';
  document.body.appendChild(ul);
})();
