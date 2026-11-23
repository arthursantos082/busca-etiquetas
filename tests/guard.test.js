// Testes de DOM do aviso "Restaurar backup" (extension/protect/guard.js). Só no navegador (tests/guard.html).
(function () {
  'use strict';
  if (typeof require === 'function') return;
  const { test, assert } = globalThis.__harness;
  const gx = globalThis.__gx;
  const used = { 'Ana': [{ id: 'retornar-ligacao', at: 1 }] };

  test('ao achar a lista, pede o backup do dia uma vez', async () => {
    await gx.wait(1500); // o guard procura a lista a cada 1 s
    assert.equal(gx.sent.filter((t) => t === 'dailyBackup').length, 1);
  });

  test('instalação nova (sem uso anterior, sem backups): sem aviso', () => {
    assert.ok(!gx.banner(), 'não deveria avisar numa instalação nova');
  });

  test('vazia mas com backups em Downloads: mostra o aviso com o arquivo', async () => {
    gx.setBackups({ count: 3, latest: 'C:\\Users\\X\\Downloads\\etiquetas-chatclinic-backups\\backup-2026-11-23.json' });
    gx.setData({ library: gx.data.library.slice() }); // dispara a reverificação
    await gx.wait();
    assert.ok(gx.banner(), 'aviso não apareceu');
    assert.ok(/backup-2026-11-23\.json/.test(gx.banner().shadowRoot.textContent));
  });

  test('"Restaurar backup" pede ao background para abrir a restauração', async () => {
    gx.btn('go').click();
    await gx.wait(50);
    assert.equal(gx.sent[gx.sent.length - 1], 'openRestore');
  });

  test('"Agora não" some com o aviso e não volta sozinho', async () => {
    gx.btn('no').click();
    await gx.wait();
    assert.ok(!gx.banner());
    assert.equal(gx.data.restoreDismissed, true);
    gx.setData({ library: gx.data.library.slice() });
    await gx.wait();
    assert.ok(!gx.banner(), 'voltou depois de dispensado');
  });

  test('etiquetas restauradas: libera avisos futuros e marca uso na página', async () => {
    gx.setData({ assignments: used });
    await gx.wait();
    assert.ok(!gx.banner());
    assert.ok(!('restoreDismissed' in gx.data), 'dispensa deveria ser limpa');
    assert.ok(localStorage.getItem('etq-etiquetas-usadas'), 'marca de uso não gravada');
  });

  test('storage some de novo, sem backups, mas a página lembra do uso: avisa', async () => {
    gx.setBackups({ count: 0, latest: null });
    gx.setData({ assignments: {} });
    await gx.wait();
    assert.ok(gx.banner(), 'deveria avisar pela marca no localStorage');
  });
})();
