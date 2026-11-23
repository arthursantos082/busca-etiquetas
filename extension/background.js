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

// A página do ChatClinic pede para abrir o gerenciador de etiquetas.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'openManager') chrome.runtime.openOptionsPage();
});
