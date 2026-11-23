// Testes da lógica de backup e restauração (extension/protect/core.js).
(function () {
  'use strict';
  const inNode = typeof require === 'function';
  const { test, assert } = inNode ? require('./harness.js') : globalThis.__harness;
  const P = inNode ? require('../extension/protect/core.js') : globalThis.EtqProtect;

  const used = { 'Ana': [{ id: 'porto', at: 1 }] };
  const dl = (id, day, suffix = '') => ({ id, filename: `C:\\Users\\X\\Downloads\\etiquetas-chatclinic-backups\\backup-${day}${suffix}.json` });

  test('dayStr usa a data local com zeros', () => {
    assert.equal(P.dayStr(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });

  test('backup: uma vez por dia', () => {
    assert.ok(P.backupDue(undefined, '2026-11-23', used), 'primeiro backup');
    assert.ok(P.backupDue('2026-11-22', '2026-11-23', used), 'novo dia');
    assert.ok(!P.backupDue('2026-11-23', '2026-11-23', used), 'mesmo dia');
  });

  test('backup: nunca de dados vazios (não empurra os bons para fora)', () => {
    assert.ok(!P.backupDue('2026-11-22', '2026-11-23', {}));
    assert.ok(!P.backupDue(undefined, '2026-11-23', undefined));
  });

  test('backup tem o formato do Exportar e vai para a pasta própria (não a da extensão)', () => {
    const b = P.buildBackup([{ id: 'porto' }], used, new Date('2026-11-23T15:00:00Z'));
    assert.deepEqual(Object.keys(b), ['app', 'version', 'exportedAt', 'library', 'assignments']);
    assert.equal(b.app, 'etiquetas-chatclinic');
    assert.equal(b.version, 1);
    assert.equal(P.backupFilename('2026-11-23'), 'etiquetas-chatclinic-backups/backup-2026-11-23.json');
  });

  test('rotação: mantém os 7 dias mais recentes', () => {
    const items = [];
    for (let d = 1; d <= 10; d++) items.push(dl(d, `2026-11-${String(d).padStart(2, '0')}`));
    assert.deepEqual(P.pickToDelete(items), { removeFile: [1, 2, 3], eraseOnly: [] });
  });

  test('rotação: mesmo dia repetido só limpa o histórico, nunca apaga o arquivo', () => {
    // Mesmo caminho nas duas entradas: removeFile(5) apagaria o backup novo (9).
    const items = [dl(5, '2026-11-20'), dl(9, '2026-11-20'), dl(7, '2026-11-21'), dl(3, '2026-11-21', ' (1)')];
    assert.deepEqual(P.pickToDelete(items), { removeFile: [], eraseOnly: [3, 5] });
  });

  test('rotação: dia antigo com entradas repetidas apaga o arquivo uma vez só', () => {
    const items = [dl(1, '2026-11-01'), dl(2, '2026-11-01'), dl(3, '2026-11-02')];
    assert.deepEqual(P.pickToDelete(items, 1), { removeFile: [2], eraseOnly: [1] });
  });

  test('rotação: ignora arquivos que não são nossos backups', () => {
    const items = [
      { id: 1, filename: 'C:\\Users\\X\\Downloads\\etiquetas-chatclinic-2026-11-01.json' }, // Exportar manual
      { id: 2, filename: 'C:\\Users\\X\\Downloads\\etiquetas-chatclinic\\content.js' },
      { id: 3, filename: 'C:\\Users\\X\\Downloads\\outra\\backup-2026-11-01.json' }
    ];
    assert.deepEqual(P.pickToDelete(items, 0), { removeFile: [], eraseOnly: [] });
  });

  test('vazia de verdade: só etiquetas padrão e nenhuma marcação', () => {
    const def = [{ id: 'retornar-ligacao' }, { id: 'aguardando-contato' }, { id: 'proximo-dia-util' }];
    assert.ok(P.looksWiped(def, {}));
    assert.ok(P.looksWiped(undefined, undefined));
    assert.ok(P.looksWiped([], {}));
  });

  test('não é "vazia": tem etiquetas próprias ou marcações', () => {
    assert.ok(!P.looksWiped([{ id: 'retornar-ligacao' }, { id: 'porto' }], {}));
    assert.ok(!P.looksWiped([{ id: 'retornar-ligacao' }], used));
  });

  test('oferecer restaurar: só se vazia, com sinal de uso e não dispensado', () => {
    const base = { wiped: true, usedBefore: false, backupCount: 0, dismissed: false };
    assert.ok(!P.shouldOfferRestore(base), 'instalação nova: sem aviso');
    assert.ok(P.shouldOfferRestore({ ...base, usedBefore: true }));
    assert.ok(P.shouldOfferRestore({ ...base, backupCount: 3 }));
    assert.ok(!P.shouldOfferRestore({ ...base, backupCount: 3, dismissed: true }));
    assert.ok(!P.shouldOfferRestore({ ...base, wiped: false, backupCount: 3 }));
  });
})();
