// Testes de DOM da barra (extension/search/bar.js). Só rodam no navegador (tests/run.html).
(function () {
  'use strict';
  if (typeof require === 'function') return; // Node: sem DOM
  const { test, assert } = globalThis.__harness;
  const fx = globalThis.__fx;
  const ALL = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Sem Etiqueta'];

  test('barra aparece logo acima da lista, com uma etiqueta por botão', async () => {
    await fx.wait();
    const bar = fx.bar();
    assert.ok(bar, 'barra não foi criada');
    assert.equal(bar.nextElementSibling, fx.list());
    const names = [...bar.shadowRoot.querySelectorAll('button.tag')].map((b) => b.textContent);
    assert.deepEqual(names, ['PORTO', 'TOKIO', 'FECHADO']);
    assert.deepEqual(fx.visibleNames(), ALL, 'sem filtro, tudo visível');
  });

  test('escolher uma etiqueta mostra só quem tem (nome com espaço duplo também casa)', async () => {
    fx.tagBtn('tokio').click();
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), ['Bruno Lima']);
    assert.equal(fx.tagBtn('tokio').getAttribute('aria-pressed'), 'true');
    assert.ok(!fx.btn('button.mode'), 'com 1 etiqueta não mostra o modo');
  });

  test('duas etiquetas: "qualquer uma" por padrão, botão troca para "todas"', async () => {
    fx.tagBtn('tokio').click(); // desmarca
    fx.tagBtn('porto').click();
    fx.tagBtn('fechado').click();
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), ['Ana Souza', 'Carla Dias']);
    assert.equal(fx.btn('button.mode').textContent, 'qualquer uma');
    fx.btn('button.mode').click();
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), ['Ana Souza']);
    assert.equal(fx.btn('button.mode').textContent, 'todas');
  });

  test('busca nativa forçando display:block não reexibe item filtrado', async () => {
    fx.list().querySelectorAll('div.conversation').forEach((el) => { el.style.display = 'block'; });
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), ['Ana Souza']);
  });

  test('itens que chegam depois (paginação/socket) já entram filtrados', async () => {
    fx.list().appendChild(fx.item(5, 'Carla Dias')); // homônimo: herda as etiquetas (limitação da chave por nome)
    fx.list().appendChild(fx.item(6, 'Novo Cliente'));
    fx.btn('button.mode').click(); // volta para "qualquer uma"
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), ['Ana Souza', 'Carla Dias', 'Carla Dias']);
  });

  test('etiqueta marcada agora (storage mudou) entra no filtro sem recarregar', async () => {
    const a = {
      'Ana Souza': [{ id: 'porto', at: 1 }, { id: 'fechado', at: 2 }],
      'Bruno Lima': [{ id: 'tokio', at: 3 }],
      'Carla Dias': [{ id: 'porto', at: 4 }],
      'Novo Cliente': [{ id: 'fechado', at: 9 }]
    };
    fx.setData({ assignments: a });
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), ['Ana Souza', 'Carla Dias', 'Carla Dias', 'Novo Cliente']);
  });

  test('etiqueta escolhida e excluída no gerenciador sai da seleção', async () => {
    fx.setData({ library: [{ id: 'porto', name: 'PORTO', color: '#2563EB' }, { id: 'tokio', name: 'TOKIO', color: '#DC2626' }] });
    await fx.wait();
    assert.ok(!fx.tagBtn('fechado'), 'botão da etiqueta excluída continua na barra');
    assert.ok(!fx.btn('button.mode'), 'sobrou 1 etiqueta escolhida, não deveria ter modo');
    assert.deepEqual(fx.visibleNames(), ['Ana Souza', 'Carla Dias', 'Carla Dias']);
  });

  test('nenhuma conversa com a etiqueta: aviso na barra', async () => {
    fx.tagBtn('porto').click(); // desmarca
    fx.list().querySelector('#contato-2').remove(); // some o único TOKIO
    fx.tagBtn('tokio').click();
    await fx.wait();
    assert.deepEqual(fx.visibleNames(), []);
    assert.ok(fx.btn('.empty'), 'aviso de vazio não apareceu');
  });

  test('"limpar" mostra tudo de novo e tira a classe dos itens', async () => {
    fx.btn('button.clear').click();
    await fx.wait();
    assert.equal(fx.visibleNames().length, 5);
    assert.equal(fx.list().querySelectorAll('.etq-search-hide').length, 0);
    assert.ok(!fx.btn('button.clear'));
  });

  test('lista recriada (troca de aba) ganha a barra de novo', async () => {
    const old = fx.list();
    const ul = document.createElement('ul');
    ul.id = 'atendimentos_contatos';
    ul.appendChild(fx.item(7, 'Bruno Lima'));
    old.replaceWith(ul);
    await fx.wait();
    assert.equal(fx.bar().nextElementSibling, ul);
    assert.equal(document.querySelectorAll('[data-etq="search-bar"]').length, 1);
  });

  test('a busca nunca grava no storage', () => {
    assert.equal(fx.writes(), 0);
  });
})();
