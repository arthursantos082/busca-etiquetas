/*
 * Ocultar etiquetas nativas do ChatClinic — parte que roda na página.
 * Só CSS: não remove nada do ChatClinic, e desligar o interruptor mostra tudo de novo na hora.
 */
(() => {
  'use strict';
  const N = globalThis.EtqNative;
  if (!N) return;
  const api = globalThis.chrome;

  function apply(v) {
    const css = N.nativeCss(v);
    // Um único <style> compartilhado: uma cópia nova do script reaproveita o da cópia antiga.
    let st = document.querySelector('style[data-etq="native-style"]');
    if (!css) { if (st) st.remove(); return; }
    if (!st) {
      st = document.createElement('style');
      st.setAttribute('data-etq', 'native-style');
      (document.head || document.documentElement).appendChild(st);
    }
    if (st.textContent !== css) st.textContent = css;
  }

  api.storage.local.get('hideNative', (d) => apply(d.hideNative));
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.hideNative) apply(changes.hideNative.newValue);
  });
})();
