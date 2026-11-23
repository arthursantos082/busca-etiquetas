/*
 * Ocultar etiquetas nativas do ChatClinic — lógica pura.
 * Gera o CSS a partir da escolha guardada em chrome.storage.local.hideNative.
 *
 * Seletores estudados ao vivo em 2026-11-23 (plan.md, T7). Cada item da lista tem uma linha
 * div.departamentos-atendimento com três chips; na mesma linha fica o contador de expiração
 * (#expira_tem…), por isso escondemos os chips um a um e nunca a linha inteira.
 */
(function (root) {
  'use strict';

  const SCOPE = '#atendimentos_contatos .departamentos-atendimento ';
  const KINDS = [
    { key: 'canal', label: 'Canal', example: 'Protege - Oficial', selector: SCOPE + '#marc-canal' },
    { key: 'depart', label: 'Departamento', example: 'Conhecer Seguros', selector: SCOPE + '#marc-depart:not(.marc-atendente)' },
    { key: 'atendente', label: 'Atendente', example: 'nome do atendente', selector: SCOPE + '.marc-atendente' }
  ];

  // Só aceita true explícito: dado estranho no storage nunca esconde nada.
  function normalize(v) {
    const o = {};
    for (const k of KINDS) o[k.key] = !!(v && typeof v === 'object' && v[k.key] === true);
    return o;
  }

  function nativeCss(v) {
    const o = normalize(v);
    const sel = KINDS.filter((k) => o[k.key]).map((k) => k.selector);
    return sel.length ? sel.join(',\n') + ' { display: none !important; }' : '';
  }

  const api = { KINDS, normalize, nativeCss };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EtqNative = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
