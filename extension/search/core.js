/*
 * Busca por Etiquetas — lógica pura (sem DOM, sem chrome.*).
 *
 * Decide quais conversas da lista ficam visíveis a partir das etiquetas
 * escolhidas na barra. Roda no content script (expõe globalThis.EtqSearch)
 * e nos testes (module.exports).
 */
(function (root) {
  'use strict';

  // Mesma normalização que o content.js usa para a chave do contato.
  const normName = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // IDs das etiquetas marcadas para um contato, só as que ainda existem na biblioteca.
  function tagIdsFor(assignments, library, key) {
    const list = (assignments && assignments[key]) || [];
    const known = new Set((library || []).map((t) => t.id));
    const out = new Set();
    for (const a of list) if (a && known.has(a.id)) out.add(a.id);
    return out;
  }

  // Sem etiqueta escolhida: tudo visível. 'any' = qualquer uma; 'all' = todas.
  function matches(itemTagIds, selected, mode) {
    if (!selected || !selected.length) return true;
    const has = (id) => itemTagIds.has(id);
    return mode === 'all' ? selected.every(has) : selected.some(has);
  }

  // Tira da seleção etiquetas que foram excluídas no gerenciador.
  function pruneSelection(selected, library) {
    const known = new Set((library || []).map((t) => t.id));
    return (selected || []).filter((id) => known.has(id));
  }

  // keys: nomes (já normalizados) das conversas, na ordem da lista.
  // Devolve um array de booleanos: true = mostrar.
  function visibility(keys, state) {
    const { assignments, library, selected, mode } = state;
    const sel = pruneSelection(selected, library);
    return keys.map((k) => matches(tagIdsFor(assignments, library, k), sel, mode));
  }

  const api = { normName, tagIdsFor, matches, pruneSelection, visibility };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EtqSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
