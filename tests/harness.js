/*
 * Mini harness de testes sem dependências.
 * - No navegador (tests/run.html, Chrome headless): coleta os testes e escreve o resultado no <pre id="out">.
 * - No Node (quando instalado): `node --test tests/` usa node:test e node:assert.
 */
(function (root) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    const { test } = require('node:test');
    module.exports = { test, assert: require('node:assert/strict') };
    return;
  }

  const tests = [];
  const fail = (msg) => { throw new Error(msg); };
  const show = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
  const assert = {
    ok: (v, m) => { if (!v) fail(m || 'esperava verdadeiro, veio ' + show(v)); },
    equal: (a, b, m) => { if (a !== b) fail(m || `esperava ${show(b)}, veio ${show(a)}`); },
    deepEqual: (a, b, m) => { if (show(a) !== show(b)) fail(m || `esperava ${show(b)}, veio ${show(a)}`); }
  };

  async function run() {
    const out = document.getElementById('out');
    const lines = [];
    let failed = 0;
    for (const t of tests) {
      try { await t.fn(); lines.push('ok   - ' + t.name); }
      catch (e) { failed++; lines.push('FAIL - ' + t.name + '\n       ' + (e && e.message)); }
    }
    lines.push(`\n${tests.length - failed}/${tests.length} passaram`);
    lines.push(failed ? 'RESULTADO: FALHOU' : 'RESULTADO: OK');
    out.textContent = lines.join('\n');
  }

  root.__harness = { test: (name, fn) => tests.push({ name, fn }), assert, run };
})(typeof globalThis !== 'undefined' ? globalThis : this);
