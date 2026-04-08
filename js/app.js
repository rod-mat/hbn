/* ═══════════════════════════════════════════════════════
   FICHA EDITOR – Main Application
   ═══════════════════════════════════════════════════════ */

/* ─── Constants ─── */
const FIGURE_SLOTS = [
  { id: 'estructura_geometrica', label: 'Estructura Geométrica',
    headerLabel: 'ESTRUCTURA GEOMÉTRICA', headerBg: '#0F6E56',
    defaultCaption: '(VESTA / XCrySDen)', gridClass: 'fg-geo' },
  { id: 'niveles', label: 'Gráfico de Niveles',
    headerLabel: 'NIVELES', headerBg: '#F5C400', headerTextDark: true,
    defaultCaption: '(midgap states)', gridClass: 'fg-levels' },
  { id: 'funcion_espectral', label: 'Función Espectral + Fonones',
    headerLabel: 'FUNCIÓN ESPECTRAL + ESPECTRO DE FONONES', headerBg: '#5B7FA6',
    defaultCaption: '(ZPL + fonones)', gridClass: 'fg-spectral' },
  { id: 'funciones_onda', label: 'Funciones de Onda / Carga',
    headerLabel: 'FUNCIONES DE ONDA O DE CARGA', headerBg: '#0F6E56',
    defaultCaption: '(isosuperficie LDOS)', gridClass: 'fg-wave' },
  { id: 'dos', label: 'DOS / pDOS',
    headerLabel: 'DOS', headerBg: '#5B7FA6',
    defaultCaption: '(proyectado por especie)', gridClass: 'fg-dos' },
  { id: 'luminiscencia', label: 'Espectro de Luminiscencia',
    headerLabel: 'ESPECTRO DE LUMINISCENCIA', headerBg: '#0F6E56',
    defaultCaption: '(PL simulado)', gridClass: 'fg-lum' },
];

const PAGE_FORMATS = {
  'a4-portrait':      { w: 794, h: 1123, label: 'A4 Portrait',      jsPDF: { unit: 'mm', format: 'a4',     orientation: 'portrait'  } },
  'a4-landscape':     { w: 1123, h: 794, label: 'A4 Landscape',     jsPDF: { unit: 'mm', format: 'a4',     orientation: 'landscape' } },
  'letter-portrait':  { w: 816, h: 1056, label: 'Letter Portrait',  jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait'  } },
  'letter-landscape': { w: 1056, h: 816, label: 'Letter Landscape', jsPDF: { unit: 'mm', format: 'letter', orientation: 'landscape' } },
};

function getPageDims() {
  return PAGE_FORMATS[state.pageFormat || 'a4-portrait'];
}

const DEFAULT_STATE = {
  meta: {
    titulo: 'Defectos puntuales en h-BN monocapa',
    subtitulo: 'Cálculo de primeros principios · DFT / HSE06',
    autor: '',
    fecha: new Date().toISOString().slice(0, 10),
    version: '1.0',
  },
  especificaciones: [
    { label: 'Sistema',       value: 'h-BN monocapa (5×5)' },
    { label: 'Defecto',       value: 'C_{B}, C_{N}, C_{B}C_{N}, V_{B}' },
    { label: 'Funcional',     value: 'HSE06 + SOC' },
    { label: 'Base',          value: 'PAW / PBE' },
    { label: 'k-mesh',        value: '— × — × 1' },
    { label: 'Vacío',         value: '≥ 20 Å' },
    { label: 'Corrección q',  value: 'Freysoldt' },
    { label: 'ZPL',           value: 'ΔSCF' },
    { label: 'E_{form}(q,μ)', value: '— eV' },
    { label: 'ε(q/q′)',       value: '—' },
  ],
  figuras: {},  // slot_id -> { caption, dataUrl }
  referencias: [
    'Toth et al. J. Phys. D 2019',
    'Sajid et al. npj Comput. Mater. 2020',
    'Turiansky et al. PRL 2019',
    'Weston et al. PRB 2018',
  ],
  footer_right: 'VASP / Quantum ESPRESSO · HSE06',
  logo: null,  // base64 data URL
  pageFormat: 'a4-portrait',
};

/* ─── State ─── */
let state = {};

/* ─── Helpers ─── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatFormula(text) {
  if (!text) return '';
  let s = text
    .replace(/\_{([^}]+)}/g, '<sub>$1</sub>')
    .replace(/\^{([^}]+)}/g, '<sup>$1</sup>')
    .replace(/_([A-Za-z0-9])/g, '<sub>$1</sub>')
    .replace(/\^([A-Za-z0-9])/g, '<sup>$1</sup>');
  return s;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ─── State Management ─── */
function loadState() {
  try {
    const raw = localStorage.getItem('ficha_editor_state');
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('Failed to load state', e); }
  return null;
}

function saveState() {
  try {
    localStorage.setItem('ficha_editor_state', JSON.stringify(state));
  } catch (e) { console.warn('Failed to save state', e); }
}

function resetState() {
  if (!confirm('¿Restaurar todos los valores por defecto? Se perderán los cambios.')) return;
  state = deepClone(DEFAULT_STATE);
  saveState();
  renderAll();
  showToast('Valores restaurados', 'info');
}

/* ═══════════════════════════════════════════════════════
   PREVIEW RENDERING
   ═══════════════════════════════════════════════════════ */

function renderPreview() {
  const page = $('#ficha-page');
  const dims = getPageDims();
  page.style.width = dims.w + 'px';
  page.style.height = dims.h + 'px';
  page.innerHTML = buildFichaHTML();
  initPreviewDropzones();
  updateScale();
}

function buildFichaHTML() {
  const m = state.meta;
  const logoHtml = state.logo
    ? `<img src="${state.logo}" alt="Logo" />`
    : `<div class="ficha-logo-placeholder">Logo</div>`;

  // Specs table rows
  const specsRows = state.especificaciones.map(s =>
    `<tr><td class="spec-l">${formatFormula(escapeHtml(s.label))}</td>
         <td class="spec-v">${formatFormula(escapeHtml(s.value))}</td></tr>`
  ).join('');

  // Figure cells
  const figCells = FIGURE_SLOTS.map(slot => {
    const fig = state.figuras[slot.id];
    const cap = fig?.caption || slot.defaultCaption;
    const headerClass = slot.headerTextDark ? ' header-gold' : '';

    let bodyContent;
    if (fig?.dataUrl) {
      bodyContent = `<img src="${fig.dataUrl}" alt="${slot.label}" />`;
    } else {
      bodyContent = `<div class="fig-ph">
        <span class="fig-ph-label">${escapeHtml(slot.label)}</span>
        <span class="fig-ph-cap">${escapeHtml(cap)}</span>
      </div>`;
    }

    // The specs cell is special
    if (slot.id === '_specs') return ''; // handled separately

    return `<div class="fig-cell ${slot.gridClass}" data-slot="${slot.id}">
      <div class="fig-cell-header${headerClass}" style="background:${slot.headerBg}">${slot.headerLabel}</div>
      <div class="fig-cell-body">${bodyContent}</div>
      <div class="drop-overlay">Soltar imagen</div>
    </div>`;
  }).join('');

  // Specs cell (replaces the figure cell for specs)
  const specsCell = `<div class="fig-cell fg-specs">
    <div class="fig-cell-header" style="background:#1D3557">ESPECIFICACIONES DE SIMULACIÓN</div>
    <div class="ficha-specs-table"><table>${specsRows}</table></div>
  </div>`;

  // References
  const refsText = state.referencias.join('  ·  ');

  return `
    <div class="ficha-header">
      <div class="ficha-header-text">
        <h1 class="ficha-title">${escapeHtml(m.titulo)}</h1>
        <div class="ficha-subtitle">${escapeHtml(m.subtitulo)}</div>
      </div>
      <div class="ficha-header-logo">${logoHtml}</div>
    </div>
    <div class="ficha-grid">
      ${figCells}
      ${specsCell}
    </div>
    <div class="ficha-footer">
      <div class="ficha-refs">${escapeHtml(refsText)}</div>
      <div class="ficha-tools">${escapeHtml(state.footer_right)}</div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════
   EDITOR RENDERING
   ═══════════════════════════════════════════════════════ */

function renderEditor() {
  renderMetaEditor();
  renderSpecsEditor();
  renderFigsEditor();
  renderRefsEditor();
}

function renderMetaEditor() {
  $('#inp-titulo').value = state.meta.titulo;
  $('#inp-subtitulo').value = state.meta.subtitulo;
  $('#inp-autor').value = state.meta.autor;
  $('#inp-fecha').value = state.meta.fecha;
  $('#inp-version').value = state.meta.version;
  $('#inp-footer-right').value = state.footer_right;

  // Logo preview
  const lp = $('#logo-preview');
  if (state.logo) {
    lp.innerHTML = `<img src="${state.logo}" alt="Logo" />`;
    lp.classList.add('has-logo');
    $('#btn-logo-remove').hidden = false;
  } else {
    lp.innerHTML = `<span class="logo-placeholder-text">Arrastra logo aquí</span>`;
    lp.classList.remove('has-logo');
    $('#btn-logo-remove').hidden = true;
  }
}

function renderSpecsEditor() {
  const list = $('#specs-list');
  list.innerHTML = state.especificaciones.map((s, i) => `
    <div class="spec-row" data-idx="${i}">
      <input type="text" value="${escapeHtml(s.label)}" placeholder="Etiqueta" data-role="label" />
      <input type="text" value="${escapeHtml(s.value)}" placeholder="Valor" data-role="value" />
      <button class="btn-remove-row" data-action="remove-spec" data-idx="${i}" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function renderFigsEditor() {
  const list = $('#figs-list');
  list.innerHTML = FIGURE_SLOTS.map(slot => {
    const fig = state.figuras[slot.id];
    const thumbContent = fig?.dataUrl
      ? `<img src="${fig.dataUrl}" alt="${slot.label}" />`
      : `<span class="thumb-hint">Click o arrastra</span>`;
    const caption = fig?.caption || slot.defaultCaption;

    return `<div class="fig-card" data-slot="${slot.id}">
      <div class="fig-card-header" style="background:${slot.headerBg}${slot.headerTextDark ? ';color:#1a1a18' : ''}">
        ${slot.label}
      </div>
      <div class="fig-card-body">
        <div class="fig-card-thumb" data-slot="${slot.id}">${thumbContent}</div>
        <input type="text" value="${escapeHtml(caption)}" placeholder="Caption"
               data-role="fig-caption" data-slot="${slot.id}" />
        <div class="fig-card-actions">
          <button class="btn-sm" data-action="upload-fig" data-slot="${slot.id}">Subir</button>
          <button class="btn-sm btn-remove" data-action="remove-fig" data-slot="${slot.id}"
                  ${fig?.dataUrl ? '' : 'hidden'}>Quitar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderRefsEditor() {
  const list = $('#refs-list');
  list.innerHTML = state.referencias.map((r, i) => `
    <div class="ref-row" data-idx="${i}">
      <input type="text" value="${escapeHtml(r)}" placeholder="Referencia" data-role="ref" />
      <button class="btn-remove-row" data-action="remove-ref" data-idx="${i}" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function renderAll() {
  renderEditor();
  renderPreview();
}

/* ═══════════════════════════════════════════════════════
   EVENT BINDING
   ═══════════════════════════════════════════════════════ */

function init() {
  state = loadState() || deepClone(DEFAULT_STATE);
  if (!state.pageFormat) state.pageFormat = 'a4-portrait';
  renderAll();
  updateScale();
  bindToolbar();
  bindTabs();
  bindEditorEvents();
  bindLogoEvents();
  bindFormatSelector();
  window.addEventListener('resize', updateScale);
}

function bindToolbar() {
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', handleImportJSON);
  $('#btn-export').addEventListener('click', handleExportJSON);
  $('#btn-pdf').addEventListener('click', handleExportPDF);
  $('#btn-reset').addEventListener('click', resetState);
}

function bindFormatSelector() {
  const sel = $('#sel-format');
  sel.value = state.pageFormat || 'a4-portrait';
  sel.addEventListener('change', (e) => {
    state.pageFormat = e.target.value;
    saveState();
    renderPreview();
    showToast('Formato: ' + PAGE_FORMATS[state.pageFormat].label, 'info');
  });
}

function bindTabs() {
  $$('.sidebar-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.sidebar-tabs .tab').forEach(t => t.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`#panel-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

function bindEditorEvents() {
  // Meta fields (simple inputs with data-field)
  document.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (field) {
      const keys = field.split('.');
      if (keys.length === 2) state[keys[0]][keys[1]] = e.target.value;
      else state[keys[0]] = e.target.value;
      saveState();
      renderPreview();
      return;
    }

    // Spec rows
    if (e.target.closest('.spec-row')) {
      const row = e.target.closest('.spec-row');
      const idx = parseInt(row.dataset.idx);
      const role = e.target.dataset.role;
      if (role === 'label') state.especificaciones[idx].label = e.target.value;
      if (role === 'value') state.especificaciones[idx].value = e.target.value;
      saveState();
      renderPreview();
      return;
    }

    // Ref rows
    if (e.target.dataset.role === 'ref') {
      const row = e.target.closest('.ref-row');
      const idx = parseInt(row.dataset.idx);
      state.referencias[idx] = e.target.value;
      saveState();
      renderPreview();
      return;
    }

    // Fig caption
    if (e.target.dataset.role === 'fig-caption') {
      const slot = e.target.dataset.slot;
      if (!state.figuras[slot]) state.figuras[slot] = { caption: '', dataUrl: null };
      state.figuras[slot].caption = e.target.value;
      saveState();
      renderPreview();
      return;
    }
  });

  // Click handlers (delegated)
  document.addEventListener('click', (e) => {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const target = e.target.closest('[data-action]');

    if (action === 'remove-spec') {
      const idx = parseInt(target.dataset.idx);
      state.especificaciones.splice(idx, 1);
      saveState();
      renderSpecsEditor();
      renderPreview();
    }
    if (action === 'remove-ref') {
      const idx = parseInt(target.dataset.idx);
      state.referencias.splice(idx, 1);
      saveState();
      renderRefsEditor();
      renderPreview();
    }
    if (action === 'upload-fig') {
      const slot = target.dataset.slot;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => handleFigUpload(slot, input.files[0]);
      input.click();
    }
    if (action === 'remove-fig') {
      const slot = target.dataset.slot;
      if (state.figuras[slot]) {
        state.figuras[slot].dataUrl = null;
        saveState();
        renderFigsEditor();
        renderPreview();
      }
    }
  });

  // Thumbnail click → upload
  document.addEventListener('click', (e) => {
    const thumb = e.target.closest('.fig-card-thumb');
    if (!thumb) return;
    const slot = thumb.dataset.slot;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => handleFigUpload(slot, input.files[0]);
    input.click();
  });

  // Add spec
  $('#btn-add-spec').addEventListener('click', () => {
    state.especificaciones.push({ label: '', value: '' });
    saveState();
    renderSpecsEditor();
    renderPreview();
  });

  // Add ref
  $('#btn-add-ref').addEventListener('click', () => {
    state.referencias.push('');
    saveState();
    renderRefsEditor();
    renderPreview();
  });

  // Figure card drag & drop
  document.addEventListener('dragover', (e) => {
    const thumb = e.target.closest('.fig-card-thumb');
    if (thumb) { e.preventDefault(); thumb.classList.add('drag-over'); }
    // Also preview drop zones
    const cell = e.target.closest('.fig-cell[data-slot]');
    if (cell) { e.preventDefault(); cell.classList.add('drag-over'); }
  });
  document.addEventListener('dragleave', (e) => {
    const thumb = e.target.closest('.fig-card-thumb');
    if (thumb) thumb.classList.remove('drag-over');
    const cell = e.target.closest('.fig-cell[data-slot]');
    if (cell) cell.classList.remove('drag-over');
  });
  document.addEventListener('drop', (e) => {
    const thumb = e.target.closest('.fig-card-thumb');
    const cell = e.target.closest('.fig-cell[data-slot]');
    const target = thumb || cell;
    if (!target) return;
    e.preventDefault();
    target.classList.remove('drag-over');
    const slot = target.dataset.slot;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFigUpload(slot, file);
    }
  });
}

function bindLogoEvents() {
  $('#btn-logo-upload').addEventListener('click', () => $('#file-logo').click());
  $('#file-logo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readFileAsDataUrl(file).then(url => {
      state.logo = url;
      saveState();
      renderMetaEditor();
      renderPreview();
      showToast('Logo actualizado', 'success');
    });
  });
  $('#btn-logo-remove').addEventListener('click', () => {
    state.logo = null;
    saveState();
    renderMetaEditor();
    renderPreview();
  });

  // Logo drag & drop
  const lz = $('#logo-dropzone');
  lz.addEventListener('dragover', (e) => { e.preventDefault(); lz.style.borderColor = 'var(--accent)'; });
  lz.addEventListener('dragleave', () => { lz.style.borderColor = ''; });
  lz.addEventListener('drop', (e) => {
    e.preventDefault();
    lz.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      readFileAsDataUrl(file).then(url => {
        state.logo = url;
        saveState();
        renderMetaEditor();
        renderPreview();
        showToast('Logo actualizado', 'success');
      });
    }
  });
}

/* ─── Preview drop zones ─── */
function initPreviewDropzones() {
  // Already handled by delegated listeners in bindEditorEvents
}

/* ─── File helpers ─── */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function handleFigUpload(slotId, file) {
  if (!file) return;
  readFileAsDataUrl(file).then(url => {
    if (!state.figuras[slotId]) {
      const slot = FIGURE_SLOTS.find(s => s.id === slotId);
      state.figuras[slotId] = { caption: slot?.defaultCaption || '', dataUrl: null };
    }
    state.figuras[slotId].dataUrl = url;
    saveState();
    renderFigsEditor();
    renderPreview();
    showToast(`Imagen cargada: ${slotId.replace(/_/g, ' ')}`, 'success');
  });
}

/* ═══════════════════════════════════════════════════════
   IMPORT / EXPORT
   ═══════════════════════════════════════════════════════ */

function handleImportJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      // Merge with defaults for missing fields
      state = { ...deepClone(DEFAULT_STATE), ...data };
      if (data.meta) state.meta = { ...deepClone(DEFAULT_STATE.meta), ...data.meta };
      if (!state.figuras) state.figuras = {};
      if (!state.referencias) state.referencias = [];
      if (!state.especificaciones) state.especificaciones = [];
      saveState();
      renderAll();
      showToast('JSON importado correctamente', 'success');
    } catch (err) {
      showToast('Error al leer el JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset input
}

function handleExportJSON() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ficha_${state.meta.fecha || 'data'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON exportado', 'success');
}

async function handleExportPDF() {
  const fichaEl = $('#ficha-page');
  const dims = getPageDims();
  showToast('Generando PDF…', 'info');

  // Temporarily reset scale for full-res render
  const scaler = $('#ficha-scaler');
  const prevTransform = scaler.style.transform;
  const prevHeight = scaler.style.height;
  scaler.style.transform = 'none';
  scaler.style.height = 'auto';

  const opt = {
    margin: 0,
    filename: `ficha_defectos_${state.meta.fecha || 'hbn'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: dims.jsPDF,
  };

  try {
    await html2pdf().set(opt).from(fichaEl).save();
    showToast('PDF descargado', 'success');
  } catch (err) {
    showToast('Error al generar PDF: ' + err.message, 'error');
  } finally {
    scaler.style.transform = prevTransform;
    scaler.style.height = prevHeight;
  }
}

/* ═══════════════════════════════════════════════════════
   SCALING
   ═══════════════════════════════════════════════════════ */

function updateScale() {
  const container = $('#preview-container');
  if (!container) return;
  const dims = getPageDims();
  const cw = container.clientWidth - 48;
  const ch = container.clientHeight - 48;
  const scaleX = cw / dims.w;
  const scaleY = ch / dims.h;
  const scale = Math.min(scaleX, scaleY, 1);
  const scaler = $('#ficha-scaler');
  scaler.style.transform = `scale(${scale})`;
  scaler.style.width = `${dims.w}px`;
  scaler.style.height = `${dims.h * scale}px`;
  scaler.style.transformOrigin = 'top center';
}

/* ═══════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ═══════════════════════════════════════════════════════
   START
   ═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);
