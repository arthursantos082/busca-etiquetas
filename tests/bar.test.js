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

  // ---- barra compacta e legível (14 etiquetas, como na máquina real) ----
  const many = ['Retornar ligação', 'Aguardando contato', 'Enviar cotação', 'PORTO', 'TOKIO',
    'Aguardando Confirmação', 'Enviar documentos', 'FECHADO', 'Outro Lotérica/Dono', 'Retornar contato',
    'Final de Dezembro', '+1 lotérica', 'Aguardo Ofício', 'Fechou c/outro - ou quase']
    .map((name, i) => ({ id: 't' + i, name, color: i === 5 ? '#FACC15' : '#7C3AED' }));
  const barH = () => fx.bar().getBoundingClientRect().height;
  const more = () => fx.btn('button.more');

  test('etiqueta não escolhida tem texto escuro, mesmo se a cor for amarela', async () => {
    document.getElementById('chatclinic').style.width = '355px'; // largura da coluna no ChatClinic
    fx.setData({ library: many });
    await fx.wait();
    const yellow = fx.tagBtn('t5');
    assert.equal(getComputedStyle(yellow).color, 'rgb(55, 65, 81)');
    yellow.click();
    await fx.wait();
    assert.equal(getComputedStyle(fx.tagBtn('t5')).backgroundColor, 'rgb(250, 204, 21)');
    assert.equal(getComputedStyle(fx.tagBtn('t5')).color, 'rgb(31, 41, 55)', 'escolhida amarela usa texto escuro');
    fx.btn('button.clear').click();
    await fx.wait();
  });

  test('muitas etiquetas: barra fica numa linha só, com "+N"', async () => {
    assert.ok(barH() <= 32, 'barra alta demais: ' + barH() + 'px');
    const btns = [...fx.bar().shadowRoot.querySelectorAll('button.tag')];
    const hidden = btns.filter((b) => b.offsetTop > btns[0].offsetTop).length;
    assert.ok(hidden > 0, 'deveria sobrar etiqueta fora da primeira linha');
    assert.ok(!more().hidden, 'botão +N não apareceu');
    assert.equal(more().textContent, `+${hidden} ▾`);
  });

  test('"+N" abre todas as linhas e "menos" recolhe', async () => {
    more().click();
    await fx.wait();
    assert.ok(barH() > 40, 'não abriu: ' + barH() + 'px');
    assert.equal(more().textContent, 'menos ▴');
    assert.equal(more().getAttribute('aria-expanded'), 'true');
    more().click();
    await fx.wait();
    assert.ok(barH() <= 32);
  });

  test('etiqueta escolhida que ficou escondida destaca o "+N"', async () => {
    more().click();
    await fx.wait();
    fx.tagBtn('t13').click(); // última, fica fora da primeira linha
    await fx.wait();
    more().click(); // recolhe
    await fx.wait();
    assert.ok(more().classList.contains('sel'), '+N deveria estar destacado');
    assert.ok(/1 escolhida/.test(more().title));
    fx.btn('button.clear').click();
    await fx.wait();
    assert.ok(!more().classList.contains('sel'));
  });

  test('coluna larga o bastante: sem "+N"', async () => {
    document.getElementById('chatclinic').style.width = '4000px';
    // No headless com tempo virtual o ResizeObserver não dispara (sem quadros); o resize da janela cobre o caso.
    window.dispatchEvent(new Event('resize'));
    await fx.wait();
    assert.ok(more().hidden, '+N não deveria aparecer');
    document.getElementById('chatclinic').style.width = '';
  });

  test('a busca nunca grava no storage', () => {
    assert.equal(fx.writes(), 0);
  });
})();
