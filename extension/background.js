importScripts('protect/core.js');
const P = self.EtqProtect;

// Cria as etiquetas iniciais na primeira instalação.
const DEFAULT_LIBRARY = [
  { id: 'retornar-ligacao', name: 'Retornar ligação', color: '#7C3AED' },
  { id: 'aguardando-contato', name: 'Aguardando contato', color: '#0D9488' },
  { id: 'proximo-dia-util', name: 'Próximo dia útil', color: '#B45309' }
];

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['library', 'assignments']);
  const patch = {};
  if (!Array.isArray(data.library)) patch.library = DEFAULT_LIBRARY;
  if (!data.assignments || typeof data.assignments !== 'object') patch.assignments = {};
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
});

// ---------- backup diário (Downloads/etiquetas-chatclinic-backups/backup-AAAA-MM-DD.json) ----------
let running = null; // evita dois backups ao mesmo tempo (o ChatClinic tem mais de um frame)

function dailyBackup() {
  if (!running) running = doBackup().catch((e) => console.warn('[etiquetas] backup falhou:', e)).finally(() => { running = null; });
  return running;
}

async function doBackup() {
  const today = P.dayStr(new Date());
  const d = await chrome.storage.local.get(['library', 'assignments', 'backupLast']);
  if (!P.backupDue(d.backupLast, today, d.assignments)) return;
  const json = JSON.stringify(P.buildBackup(d.library || [], d.assignments, new Date()), null, 2);
  await chrome.downloads.download({
    url: 'data:application/json;charset=utf-8,' + encodeURIComponent(json),
    filename: P.backupFilename(today),
    conflictAction: 'overwrite',
    saveAs: false
  });
  await chrome.storage.local.set({ backupLast: today });
  await rotate();
}

// Mantém só os últimos 7 dias. Depende do histórico de downloads do Chrome:
// se o histórico foi limpo, arquivos antigos ficam na pasta (não são apagados).
async function rotate() {
  const items = (await ourBackups()).map((it) => ({ id: it.id, filename: it.filename }));
  const { removeFile, eraseOnly } = P.pickToDelete(items);
  for (const id of removeFile) {
    try { await chrome.downloads.removeFile(id); } catch (e) { /* arquivo já não existe */ }
    await chrome.downloads.erase({ id });
  }
  for (const id of eraseOnly) await chrome.downloads.erase({ id });
}

async function ourBackups() {
  const all = await chrome.downloads.search({ filenameRegex: 'etiquetas-chatclinic-backups', exists: true });
  return all.filter((it) => it.state !== 'interrupted' && P.FILE_RE.test(it.filename));
}

// ---------- mensagens da página do ChatClinic ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg) return;
  if (msg.type === 'openManager') chrome.runtime.openOptionsPage();
  if (msg.type === 'openRestore') chrome.tabs.create({ url: chrome.runtime.getURL('manager.html#restaurar') });
  if (msg.type === 'dailyBackup') dailyBackup();
  if (msg.type === 'backupsInfo') {
    ourBackups()
      .then((list) => {
        list.sort((a, b) => (a.filename < b.filename ? 1 : -1));
        reply({ count: list.length, latest: list[0] ? list[0].filename : null });
      })
      .catch(() => reply({ count: 0, latest: null }));
    return true; // resposta assíncrona
  }
});
