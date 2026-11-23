/*
 * Proteção contra perda de etiquetas — lógica pura (sem chrome.*).
 * Usada pelo background (importScripts), pelo content script, pelo gerenciador e pelos testes.
 */
(function (root) {
  'use strict';

  // Subpasta dentro de Downloads. NÃO é a pasta da extensão (Downloads/etiquetas-chatclinic).
  const BACKUP_DIR = 'etiquetas-chatclinic-backups';
  const KEEP = 7;
  const DEFAULT_IDS = ['retornar-ligacao', 'aguardando-contato', 'proximo-dia-util'];
  const FILE_RE = /[\\/]etiquetas-chatclinic-backups[\\/]backup-(\d{4}-\d{2}-\d{2})(?: \(\d+\))?\.json$/;

  // Data local AAAA-MM-DD (o "dia" do atendente, não o UTC).
  function dayStr(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const isEmptyAssignments = (a) => !a || typeof a !== 'object' || !Object.keys(a).length;

  // Backup só uma vez por dia e nunca de dados vazios (senão 7 dias "vazios" empurrariam os bons para fora).
  function backupDue(last, today, assignments) {
    return last !== today && !isEmptyAssignments(assignments);
  }

  // Mesmo formato do botão Exportar do gerenciador (o Importar aceita direto).
  function buildBackup(library, assignments, now) {
    return { app: 'etiquetas-chatclinic', version: 1, exportedAt: now.toISOString(), library, assignments };
  }

  function backupFilename(today) {
    return `${BACKUP_DIR}/backup-${today}.json`;
  }

  // items: [{ id, filename }] do histórico de downloads. Devolve:
  //  removeFile: ids de dias fora dos KEEP mais recentes (apaga o arquivo e a entrada);
  //  eraseOnly:  entradas repetidas do mesmo dia (só limpa o histórico — o caminho pode ser o
  //              mesmo do backup novo, e apagar o arquivo pela entrada velha apagaria o novo).
  function pickToDelete(items, keep = KEEP) {
    const byDay = new Map();
    const eraseOnly = [];
    for (const it of items) {
      const m = FILE_RE.exec(it.filename || '');
      if (!m) continue;
      const prev = byDay.get(m[1]);
      if (!prev) byDay.set(m[1], it);
      else if (it.id > prev.id) { eraseOnly.push(prev.id); byDay.set(m[1], it); }
      else eraseOnly.push(it.id);
    }
    const days = [...byDay.keys()].sort().reverse();
    const removeFile = days.slice(keep).map((d) => byDay.get(d).id);
    const num = (a, b) => a - b;
    return { removeFile: removeFile.sort(num), eraseOnly: eraseOnly.sort(num) };
  }

  // A extensão "abriu vazia": nenhuma marcação e só as etiquetas padrão (ou nenhuma).
  // Quem criou etiquetas próprias e só desmarcou tudo não cai aqui.
  function looksWiped(library, assignments) {
    if (!isEmptyAssignments(assignments)) return false;
    if (!Array.isArray(library)) return true;
    return library.every((t) => t && DEFAULT_IDS.includes(t.id));
  }

  // Oferece restaurar se está vazia E há sinal de uso anterior (marca na página ou backups em Downloads).
  function shouldOfferRestore({ wiped, usedBefore, backupCount, dismissed }) {
    return !!wiped && !dismissed && (!!usedBefore || backupCount > 0);
  }

  const api = { BACKUP_DIR, KEEP, FILE_RE, dayStr, backupDue, buildBackup, backupFilename, pickToDelete, looksWiped, shouldOfferRestore };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EtqProtect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
