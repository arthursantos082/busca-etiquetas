// Testes da lógica de ocultar etiquetas nativas (extension/native/core.js).
(function () {
  'use strict';
  const inNode = typeof require === 'function';
  const { test, assert } = inNode ? require('./harness.js') : globalThis.__harness;
  const N = inNode ? require('../extension/native/core.js') : globalThis.EtqNative;

  test('nada escolhido (ou sem configuração): nenhum CSS', () => {
    assert.equal(N.nativeCss(undefined), '');
    assert.equal(N.nativeCss({}), '');
    assert.equal(N.nativeCss({ canal: false, depart: false, atendente: false }), '');
  });

  test('só aceita true de verdade (valor estranho no storage não esconde)', () => {
    assert.deepEqual(N.normalize({ canal: 'sim', depart: 1, atendente: true }), { canal: false, depart: false, atendente: true });
    assert.deepEqual(N.normalize('lixo'), { canal: false, depart: false, atendente: false });
  });

  test('cada interruptor gera só o seu seletor, dentro da lista de conversas', () => {
    const css = N.nativeCss({ depart: true });
    assert.ok(css.includes('#marc-depart:not(.marc-atendente)'));
    assert.ok(!css.includes('#marc-canal'));
    assert.ok(!/\.marc-atendente\s*[,{]/.test(css.replace(':not(.marc-atendente)', '')));
    assert.ok(css.startsWith('#atendimentos_contatos .departamentos-atendimento '));
  });

  test('nunca esconde a linha inteira (o contador de expiração fica nela)', () => {
    const css = N.nativeCss({ canal: true, depart: true, atendente: true });
    assert.ok(!/\.departamentos-atendimento\s*[,{]/.test(css));
    assert.equal(css.split(',').length, 3);
  });
})();
