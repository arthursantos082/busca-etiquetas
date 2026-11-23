/*
 * Réplica mínima da lista de conversas do ChatClinic (estrutura vista em 2026-11-23, plan.md §2.3a)
 * e um chrome.storage falso, para testar search/bar.js no navegador sem a extensão instalada.
 * Nomes são fictícios.
 */
(function () {
  'use strict';

  const listeners = [];
  const data = {
    library: [
      { id: 'porto', name: 'PORTO', color: '#2563EB' },
      { id: 'tokio', name: 'TOKIO', color: '#DC2626' },
      { id: 'fechado', name: 'FECHADO', color: '#16A34A' }
    ],
    assignments: {
      'Ana Souza': [{ id: 'porto', at: 1 }, { id: 'fechado', at: 2 }],
      'Bruno Lima': [{ id: 'tokio', at: 3 }],
      'Carla Dias': [{ id: 'porto', at: 4 }]
    }
  };
  let writes = 0;

  globalThis.chrome = {
    storage: {
      local: {
        get: (keys, cb) => setTimeout(() => cb(JSON.parse(JSON.stringify(data))), 0),
        set: () => { writes++; }
      },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    },
    runtime: { sendMessage: () => {} }
  };

  globalThis.__fx = {
    writes: () => writes,
    // Simula o gerenciador/content.js gravando no storage.
    setData(patch) {
      const changes = {};
      for (const k of Object.keys(patch)) { changes[k] = { oldValue: data[k], newValue: patch[k] }; data[k] = patch[k]; }
      listeners.forEach((fn) => fn(changes, 'local'));
    },
    // Cria um item igual ao do ChatClinic.
    item(id, name) {
      const d = document.createElement('div');
      d.className = 'conversation';
      d.id = 'contato-' + id;
      d.dataset.id = String(id);
      d.setAttribute('onclick', 'chamarChatAtendimento(this)');
      const n = document.createElement('div');
      n.className = 'conversation__name';
      const t = document.createElement('span');
      t.className = 'conversation__name--title';
      t.textContent = name;
      n.appendChild(t);
      d.appendChild(n);
      return d;
    },
    list: () => document.getElementById('atendimentos_contatos'),
    bar: () => document.querySelector('[data-etq="search-bar"]'),
    btn: (sel) => __fx.bar().shadowRoot.querySelector(sel),
    tagBtn: (id) => __fx.btn(`button.tag[data-id="${id}"]`),
    visibleNames() {
      return [...__fx.list().querySelectorAll('div.conversation')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => el.querySelector('.conversation__name--title').textContent.replace(/\s+/g, ' ').trim());
    },
    wait: (ms = 250) => new Promise((r) => setTimeout(r, ms))
  };

  // Monta a página: campo de busca nativo + lista.
  const wrap = document.createElement('div');
  wrap.id = 'chatclinic';
  const search = document.createElement('input');
  search.id = 'userSearch';
  search.placeholder = 'Procure aqui...';
  const ul = document.createElement('ul');
  ul.id = 'atendimentos_contatos';
  [[1, 'Ana Souza'], [2, 'Bruno  Lima'], [3, 'Carla Dias'], [4, 'Diego Sem Etiqueta']]
    .forEach(([id, name]) => ul.appendChild(__fx.item(id, name)));
  wrap.append(search, ul);
  document.body.appendChild(wrap);
})();
