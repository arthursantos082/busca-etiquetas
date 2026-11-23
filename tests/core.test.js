// Testes da lógica pura do filtro (extension/search/core.js).
(function () {
  'use strict';
  const inNode = typeof require === 'function';
  const { test, assert } = inNode ? require('./harness.js') : globalThis.__harness;
  const S = inNode ? require('../extension/search/core.js') : globalThis.EtqSearch;

  const library = [
    { id: 'porto', name: 'PORTO', color: '#2563EB' },
    { id: 'tokio', name: 'TOKIO', color: '#DC2626' },
    { id: 'fechado', name: 'FECHADO', color: '#16A34A' }
  ];
  const assignments = {
    'Ana Souza': [{ id: 'porto', at: 1 }, { id: 'fechado', at: 2 }],
    'Bruno Lima': [{ id: 'tokio', at: 3 }],
    'Carla Dias': [{ id: 'porto', at: 4 }, { id: 'excluida', at: 5 }]
  };
  const keys = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Sem Etiqueta'];
  const vis = (selected, mode) => S.visibility(keys, { assignments, library, selected, mode });

  test('normName colapsa espaços e tira as pontas, como o content.js', () => {
    assert.equal(S.normName('  Ana \n  Souza  '), 'Ana Souza');
    assert.equal(S.normName(null), '');
  });

  test('sem etiqueta escolhida, tudo fica visível', () => {
    assert.deepEqual(vis([], 'any'), [true, true, true, true]);
  });

  test('uma etiqueta: mostra só quem tem', () => {
    assert.deepEqual(vis(['porto'], 'any'), [true, false, true, false]);
  });

  test('"qualquer uma": basta ter uma das escolhidas', () => {
    assert.deepEqual(vis(['tokio', 'fechado'], 'any'), [true, true, false, false]);
  });

  test('"todas": precisa ter todas as escolhidas', () => {
    assert.deepEqual(vis(['porto', 'fechado'], 'all'), [true, false, false, false]);
  });

  test('modo desconhecido cai em "qualquer uma"', () => {
    assert.deepEqual(vis(['tokio', 'fechado'], undefined), [true, true, false, false]);
  });

  test('marcação de etiqueta excluída da biblioteca é ignorada', () => {
    const ids = S.tagIdsFor(assignments, library, 'Carla Dias');
    assert.deepEqual([...ids], ['porto']);
  });

  test('etiqueta escolhida e depois excluída sai da seleção (não esconde tudo)', () => {
    assert.deepEqual(S.pruneSelection(['porto', 'sumiu'], library), ['porto']);
    assert.deepEqual(vis(['sumiu'], 'all'), [true, true, true, true]);
  });

  test('dados vazios ou ausentes não quebram', () => {
    assert.deepEqual(S.visibility(['X'], { assignments: undefined, library: undefined, selected: ['porto'], mode: 'any' }), [true]);
    assert.deepEqual(S.visibility([], { assignments, library, selected: ['porto'], mode: 'any' }), []);
  });
})();
