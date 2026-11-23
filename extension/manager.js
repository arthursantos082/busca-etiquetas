const PALETTE = ['#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0D9488', '#2563EB', '#7C3AED', '#DB2777', '#B45309', '#475569'];
const MAX = 25;

let library = [];
let assignments = {};
let editingId = null;
let color = PALETTE[6];

const $ = (id) => document.getElementById(id);

function textColor(hex) {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1f2937' : '#ffffff';
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
}
function usage(id) {
  return Object.values(assignments).filter((list) => list.some((a) => a.id === id)).length;
}

async function load() {
  const d = await chrome.storage.local.get(['library', 'assignments']);
  library = Array.isArray(d.library) ? d.library : [];
  assignments = d.assignments && typeof d.assignments === 'object' ? d.assignments : {};
  render();
  renderProtection();
}

// ---------- backup automático e aviso de restauração ----------
async function renderProtection() {
  const P = window.EtqProtect;
  if (!P) return;
  const d = await chrome.storage.local.get(['library', 'assignments', 'backupLast', 'restoreDismissed']);
  let backups = [];
  try {
    backups = (await chrome.downloads.search({ filenameRegex: P.BACKUP_DIR, exists: true }))
      .filter((it) => it.state !== 'interrupted' && P.FILE_RE.test(it.filename))
      .sort((a, b) => (a.filename < b.filename ? 1 : -1));
  } catch { /* sem permissão de downloads */ }

  const last = d.backupLast ? d.backupLast.split('-').reverse().join('/') : null;
  $('autoBackup').textContent = last
    ? `Backup automático: último em ${last} (Downloads › ${P.BACKUP_DIR}, guarda ${P.KEEP} dias).`
    : `Backup automático: diário, ao abrir o ChatClinic (Downloads › ${P.BACKUP_DIR}).`;

  const wiped = P.looksWiped(d.library, d.assignments);
  const asked = location.hash === '#restaurar';
  const show = wiped && (asked || P.shouldOfferRestore({
    wiped, usedBefore: false, backupCount: backups.length, dismissed: !!d.restoreDismissed
  }));
  $('restore').hidden = !show;
  $('restoreFile').textContent = backups[0] ? 'Último backup automático: ' + backups[0].filename : '';
}
function save() {
  return chrome.storage.local.set({ library, assignments });
}

// ---------- formulário ----------
function renderColors() {
  const box = $('colors');
  box.innerHTML = '';
  for (const c of PALETTE) {
    const b = document.createElement('button');
    b.className = 'sw' + (c.toLowerCase() === color.toLowerCase() ? ' sel' : '');
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => { color = c; renderForm(); });
    box.appendChild(b);
  }
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.title = 'Outra cor';
  custom.value = color;
  custom.addEventListener('input', () => { color = custom.value.toUpperCase(); renderForm(false); });
  box.appendChild(custom);
}
function renderForm(redrawColors = true) {
  const name = $('name').value.trim();
  $('count').textContent = MAX - $('name').value.length;
  const p = $('preview');
  p.textContent = name || 'Etiqueta';
  p.style.background = color;
  p.style.color = textColor(color);
  $('save').disabled = !name;
  $('save').textContent = editingId ? 'Salvar alterações' : '+ Criar etiqueta';
  $('cancel').hidden = !editingId;
  $('formTitle').textContent = editingId ? 'Editar etiqueta' : 'Nova etiqueta';
  if (redrawColors) renderColors();
}
function resetForm() {
  editingId = null;
  $('name').value = '';
  color = PALETTE[library.length % PALETTE.length];
  renderForm();
  render();
}

async function submit() {
  const name = $('name').value.trim().slice(0, MAX);
  if (!name) return;
  const dup = library.find((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== editingId);
  if (dup) { toast('Já existe uma etiqueta com esse nome'); return; }
  if (editingId) {
    library = library.map((t) => (t.id === editingId ? { ...t, name, color } : t));
    toast('Etiqueta atualizada');
  } else {
    library = [...library, { id: uid(), name, color }];
    toast('Etiqueta criada');
  }
  await save();
  resetForm();
}

// ---------- listas ----------
function render() {
  const lib = $('library');
  lib.innerHTML = '';
  $('total').textContent = library.length === 1 ? '1 etiqueta' : `${library.length} etiquetas`;
  if (!library.length) lib.innerHTML = '<span class="empty">Nenhuma etiqueta. Crie a primeira acima.</span>';
  for (const t of library) {
    const c = document.createElement('span');
    c.className = 'chip' + (t.id === editingId ? ' editing' : '');
    c.style.background = t.color;
    c.style.color = textColor(t.color);
    c.title = 'Clique para editar';
    const label = document.createElement('span');
    label.textContent = t.name;
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '✕';
    x.title = 'Excluir';
    x.addEventListener('click', async (e) => {
      e.stopPropagation();
      const n = usage(t.id);
      const msg = n
        ? `Excluir "${t.name}"? Ela será removida de ${n} conversa${n > 1 ? 's' : ''}.`
        : `Excluir "${t.name}"?`;
      if (!confirm(msg)) return;
      library = library.filter((l) => l.id !== t.id);
      for (const k of Object.keys(assignments)) {
        assignments[k] = assignments[k].filter((a) => a.id !== t.id);
        if (!assignments[k].length) delete assignments[k];
      }
      await save();
      if (editingId === t.id) resetForm(); else render();
      toast('Etiqueta excluída');
    });
    c.addEventListener('click', () => {
      editingId = t.id;
      $('name').value = t.name;
      color = t.color;
      renderForm();
      render();
      $('name').focus();
    });
    c.append(label, x);
    lib.appendChild(c);
  }

  const convs = $('convs');
  convs.innerHTML = '';
  const entries = Object.entries(assignments)
    .map(([k, list]) => [k, list.filter((a) => library.some((t) => t.id === a.id))])
    .filter(([, list]) => list.length)
    .sort((a, b) => Math.max(...b[1].map((x) => x.at || 0)) - Math.max(...a[1].map((x) => x.at || 0)));
  $('convTotal').textContent = entries.length ? String(entries.length) : '';
  if (!entries.length) convs.innerHTML = '<span class="empty">Nenhuma conversa etiquetada ainda. No ChatClinic, abra uma conversa e clique em "🏷 Etiquetas".</span>';
  for (const [k, list] of entries) {
    const row = document.createElement('div');
    row.className = 'conv';
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = k;
    n.title = k;
    const c = document.createElement('span');
    c.className = 'c';
    for (const a of list) {
      const t = library.find((l) => l.id === a.id);
      const m = document.createElement('span');
      m.className = 'mini';
      m.textContent = t.name;
      m.style.background = t.color;
      m.style.color = textColor(t.color);
      if (a.at) m.title = 'Marcada em ' + new Date(a.at).toLocaleString('pt-BR');
      c.appendChild(m);
    }
    const clr = document.createElement('button');
    clr.className = 'link';
    clr.textContent = 'limpar';
    clr.title = 'Tirar todas as etiquetas desta conversa';
    clr.addEventListener('click', async () => {
      delete assignments[k];
      await save();
      render();
    });
    row.append(n, c, clr);
    convs.appendChild(row);
  }
}

// ---------- backup ----------
function exportBackup() {
  const data = JSON.stringify({ app: 'etiquetas-chatclinic', version: 1, exportedAt: new Date().toISOString(), library, assignments }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = `etiquetas-chatclinic-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.library) || typeof d.assignments !== 'object') throw new Error();
    if (!confirm('Substituir suas etiquetas atuais pelas do arquivo?')) return;
    library = d.library.filter((t) => t && t.id && t.name && /^#[0-9a-f]{6}$/i.test(t.color));
    assignments = d.assignments || {};
    await save();
    resetForm();
    toast('Etiquetas importadas');
  } catch {
    toast('Arquivo inválido');
  }
}

// ---------- início ----------
if (chrome.tabs && chrome.tabs.getCurrent) {
  chrome.tabs.getCurrent((tab) => { if (tab) document.body.classList.add('page'); });
}
$('name').addEventListener('input', () => renderForm(false));
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape' && editingId) resetForm(); });
$('save').addEventListener('click', submit);
$('cancel').addEventListener('click', resetForm);
$('export').addEventListener('click', exportBackup);
$('import').addEventListener('click', () => $('file').click());
$('restoreBtn').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local') load(); });

load().then(() => { color = PALETTE[library.length % PALETTE.length]; renderForm(); });
