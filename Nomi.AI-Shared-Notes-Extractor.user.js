// ==UserScript==
// @name         Nomi.AI Shared Notes Extractor
// @namespace    https://github.com/spacegoblins/nomi.ai-shared-notes-extractor
// @version      1.2
// @description  Export and import your Nomi's Shared Notes in multiple formats (.txt, .md, .csv). Not affiliated with Nomi.ai or Glimpse.ai.
// @author       spacegoblins
// @license      MIT
// @match        *://beta.nomi.ai/nomis/*/shared-notes*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/spacegoblins/nomi.ai-shared-notes-extractor/tampermonkey/Nomi.AI-Shared-Notes-Extractor.user.js
// @downloadURL  https://raw.githubusercontent.com/spacegoblins/nomi.ai-shared-notes-extractor/tampermonkey/Nomi.AI-Shared-Notes-Extractor.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Guard: don't inject twice
  if (window.__nomiExtInjected) return;
  window.__nomiExtInjected = true;

  // ── Styles ──

  GM_addStyle(`
/* Nomi.AI Shared Notes Extractor — injected styles */
/* All selectors scoped with nomi-ext- prefix to avoid conflicts */

/* Button container */
.nomi-ext-btn-group {
  display: flex;
  gap: 14px;
  align-items: center;
}

/* Pipe divider */
.nomi-ext-divider {
  font-family: 'Urbanist', sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 30.8px;
  color: rgb(201, 201, 201);
  user-select: none;
}

/* Shared button base — matches header h3 styling */
.nomi-ext-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  font-family: 'Urbanist', sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 30.8px;
  color: rgb(201, 201, 201);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s;
}
.nomi-ext-btn:hover { color: #fff; }
.nomi-ext-btn:active { color: #e0e0e0; }

/* Settings button — slightly smaller to feel like an icon */
.nomi-ext-btn-settings {
  font-size: 18px;
  line-height: 1;
}

/* ── Modal overlay ── */
.nomi-ext-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  font-family: 'Urbanist', sans-serif;
}

.nomi-ext-modal {
  background: #1f222a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 20px 24px;
  max-width: 420px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  color: #e4e4e7;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.nomi-ext-modal-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 12px;
  color: #e4e4e7;
}

.nomi-ext-modal-body {
  font-size: 12px;
  line-height: 1.6;
  color: #d4d4d8;
}

.nomi-ext-modal-warning {
  font-size: 11px;
  color: #fca5a5;
  line-height: 1.5;
  margin-bottom: 6px;
}

.nomi-ext-modal-info {
  font-size: 11px;
  color: #a1a1aa;
  margin-bottom: 10px;
}

.nomi-ext-modal-field-warn {
  font-size: 11px;
  color: #fcd34d;
  margin-bottom: 8px;
}

/* ── Modal action buttons ── */
.nomi-ext-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  justify-content: flex-end;
}

.nomi-ext-modal-btn {
  padding: 7px 16px;
  border: none;
  border-radius: 4px;
  font-family: 'Urbanist', sans-serif;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.nomi-ext-modal-btn:hover { opacity: 0.85; }

.nomi-ext-modal-btn-confirm {
  background: #4f46e5;
  color: #fff;
}

.nomi-ext-modal-btn-cancel {
  background: #3f3f46;
  color: #e4e4e7;
}

/* ── Toast ── */
.nomi-ext-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100000;
  padding: 10px 16px;
  border-radius: 6px;
  font-family: 'Urbanist', sans-serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  max-width: 340px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  animation: nomi-ext-fadein 0.2s ease;
}

.nomi-ext-toast-success {
  background: #14532d;
  border: 1px solid #166534;
  color: #86efac;
}

.nomi-ext-toast-error {
  background: #7f1d1d;
  border: 1px solid #991b1b;
  color: #fca5a5;
}

@keyframes nomi-ext-fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Settings panel ── */
.nomi-ext-settings-desc {
  font-size: 12px;
  color: #a1a1aa;
  margin-bottom: 10px;
}

.nomi-ext-settings-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.nomi-ext-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #e4e4e7;
}

.nomi-ext-checkbox-row input[type="checkbox"] {
  accent-color: #818cf8;
  width: 14px;
  height: 14px;
}

.nomi-ext-settings-link {
  font-size: 11px;
  color: #818cf8;
  text-decoration: underline;
}
`);

  // ── Field Definitions ──

  const FIELD_DEFINITIONS = [
    { key: 'backstory',            label: 'BACKSTORY' },
    { key: 'inclination',          label: 'INCLINATION' },
    { key: 'currentRoleplay',      label: 'CURRENT ROLEPLAY' },
    { key: 'yourAppearance',       label: 'YOUR APPEARANCE' },
    { key: 'nomiAppearance',       label: "NOMI'S APPEARANCE" },
    { key: 'appearanceTendencies', label: 'APPEARANCE TENDENCIES' },
    { key: 'nicknames',            label: 'NICKNAMES' },
    { key: 'preferences',          label: 'PREFERENCES' },
    { key: 'desires',              label: 'DESIRES' },
    { key: 'boundaries',           label: 'BOUNDARIES' },
  ];

  const CSV_FIELD_KEYS = FIELD_DEFINITIONS.map(f =>
    f.key.replace(/([A-Z])/g, '_$1').toLowerCase()
  );

  // ── Settings ──

  const DEFAULT_SETTINGS = {
    exportFormats: { txt: true, md: false, csv: false },
  };

  function loadSettings() {
    try {
      const stored = GM_getValue('settings', null);
      if (stored) {
        return Object.assign(structuredClone(DEFAULT_SETTINGS), stored);
      }
    } catch (e) { /* storage unavailable */ }
    return structuredClone(DEFAULT_SETTINGS);
  }

  function saveSettings(settings) {
    GM_setValue('settings', settings);
  }

  function getSelectedFormatLabels(settings) {
    const labels = [];
    if (settings.exportFormats.txt) labels.push('.txt');
    if (settings.exportFormats.md)  labels.push('.md');
    if (settings.exportFormats.csv) labels.push('.csv');
    return labels;
  }

  // ── Utility ──

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getNomiName() {
    const parts = document.title.split('|').map(s => s.trim());
    for (const part of parts) {
      if (part && !/shared notes/i.test(part) && !/nomi\.ai/i.test(part)) return part;
    }
    const urlMatch = window.location.pathname.match(/\/nomis\/(\d+)/);
    return urlMatch ? `Nomi_${urlMatch[1]}` : 'Nomi';
  }

  function getNomiId() {
    const m = window.location.pathname.match(/\/nomis\/(\d+)/);
    return m ? m[1] : 'unknown';
  }

  function getTimestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }

  // ── DOM Reading ──

  async function scrollToRevealAll() {
    const scrollStep = 400;
    const delay = 80;
    let pos = 0;
    while (pos < document.body.scrollHeight) {
      window.scrollTo(0, pos);
      await sleep(delay);
      pos += scrollStep;
    }
    window.scrollTo(0, 0);
    await sleep(300);
  }

  function readTextareas() {
    return Array.from(document.querySelectorAll('textarea')).map(ta =>
      ta.value ? ta.value.trim() : ''
    );
  }

  function collectExportData() {
    const nomiName = getNomiName();
    const nomiId = getNomiId();
    const fieldValues = readTextareas();
    const timestamp = getTimestamp();
    const now = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return { nomiName, nomiId, fieldValues, timestamp, now };
  }

  // ── Format Builders ──

  function buildTxt(data) {
    const divider = '\u2550'.repeat(50);
    const lines = [
      divider,
      `${data.nomiName.toUpperCase()} \u2014 SHARED NOTES`,
      `Exported: ${data.now}`,
      `Nomi ID (From URL): ${data.nomiId}`,
      divider, '',
    ];
    if (data.fieldValues.length !== FIELD_DEFINITIONS.length) {
      lines.push(`\u26A0 WARNING: Expected ${FIELD_DEFINITIONS.length} fields, found ${data.fieldValues.length}.`);
      lines.push('');
    }
    FIELD_DEFINITIONS.forEach((field, i) => {
      const value = data.fieldValues[i] || '';
      lines.push(`${field.label}:`);
      lines.push(value !== '' ? `\`${value}\`` : '(empty)');
      lines.push('');
    });
    lines.push(divider, '');
    return lines.join('\n');
  }

  function buildMd(data) {
    const lines = [
      `# ${data.nomiName} \u2014 Shared Notes`,
      '', `> Exported: ${data.now}`,
      `> Nomi ID: ${data.nomiId}`, '',
    ];
    FIELD_DEFINITIONS.forEach((field, i) => {
      const value = data.fieldValues[i] || '';
      lines.push(`## ${field.label}`);
      lines.push(value !== '' ? value : '*(empty)*');
      lines.push('');
    });
    return lines.join('\n');
  }

  function csvEscape(value) {
    if (/[",\n\r]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  function buildCsv(data) {
    const headers = ['nomi_name', 'nomi_id', 'export_timestamp', ...CSV_FIELD_KEYS];
    const values = [
      csvEscape(data.nomiName),
      csvEscape(data.nomiId),
      csvEscape(data.now),
      ...data.fieldValues.map(v => csvEscape(v || '')),
    ];
    return headers.join(',') + '\n' + values.join(',') + '\n';
  }

  // ── Download ──

  function download(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Parsers (for Import) ──

  function parseTxtFile(text) {
    const fields = {};
    const warnings = [];
    for (const field of FIELD_DEFINITIONS) {
      const pattern = new RegExp(
        `^${escapeRegex(field.label)}:\\s*\\n(?:\`([\\s\\S]*?)\`|\\(empty\\))`, 'm'
      );
      const match = text.match(pattern);
      if (match) {
        fields[field.key] = match[1] !== undefined ? match[1] : '';
      } else {
        fields[field.key] = '';
        warnings.push(field.label);
      }
    }
    return { fields, warnings };
  }

  function parseMdFile(text) {
    const fields = {};
    const warnings = [];
    for (const field of FIELD_DEFINITIONS) {
      const headingPattern = new RegExp(`^## ${escapeRegex(field.label)}\\s*$`, 'm');
      const match = headingPattern.exec(text);
      if (match) {
        const startIdx = match.index + match[0].length;
        const nextHeading = text.indexOf('\n## ', startIdx);
        const bodySlice = nextHeading !== -1
          ? text.substring(startIdx, nextHeading)
          : text.substring(startIdx);
        const value = bodySlice.trim();
        fields[field.key] = (value === '*(empty)*' || value === '') ? '' : value;
      } else {
        fields[field.key] = '';
        warnings.push(field.label);
      }
    }
    return { fields, warnings };
  }

  function parseCsvFile(text) {
    const fields = {};
    const warnings = [];
    const lines = text.split('\n');
    if (lines.length < 2) {
      return { fields: null, error: 'CSV file must have at least a header row and one data row.' };
    }
    const headers = parseCsvRow(lines[0]);
    const dataText = lines.slice(1).join('\n').trim();
    if (!dataText) {
      return { fields: null, error: 'CSV file has no data row.' };
    }
    const values = parseCsvRow(dataText);
    for (let i = 0; i < FIELD_DEFINITIONS.length; i++) {
      const csvKey = CSV_FIELD_KEYS[i];
      const colIdx = headers.indexOf(csvKey);
      if (colIdx !== -1 && colIdx < values.length) {
        fields[FIELD_DEFINITIONS[i].key] = values[colIdx];
      } else {
        fields[FIELD_DEFINITIONS[i].key] = '';
        warnings.push(FIELD_DEFINITIONS[i].label);
      }
    }
    return { fields, warnings };
  }

  function parseCsvRow(text) {
    const result = [];
    let i = 0;
    while (i <= text.length) {
      if (i === text.length) { result.push(''); break; }
      if (text[i] === '"') {
        let value = '';
        i++;
        while (i < text.length) {
          if (text[i] === '"') {
            if (i + 1 < text.length && text[i + 1] === '"') {
              value += '"'; i += 2;
            } else { i++; break; }
          } else { value += text[i]; i++; }
        }
        result.push(value);
        if (i < text.length && text[i] === ',') i++;
        else break;
      } else {
        const nextComma = text.indexOf(',', i);
        const nextNewline = text.indexOf('\n', i);
        let end;
        if (nextComma === -1) end = text.length;
        else if (nextNewline !== -1 && nextNewline < nextComma) end = text.length;
        else end = nextComma;
        result.push(text.substring(i, end));
        i = end + 1;
        if (end === text.length) break;
      }
    }
    return result;
  }

  // ── Toast ──

  function showToast(message, type, duration) {
    duration = duration || 4000;
    const existing = document.querySelector('.nomi-ext-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `nomi-ext-toast nomi-ext-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // ── Modal ──

  function showModal(title, bodyNodes, actions) {
    removeModal();
    const overlay = document.createElement('div');
    overlay.className = 'nomi-ext-overlay';
    overlay.dataset.nomiExtModal = 'true';

    const modal = document.createElement('div');
    modal.className = 'nomi-ext-modal';

    const titleEl = document.createElement('div');
    titleEl.className = 'nomi-ext-modal-title';
    titleEl.textContent = title;
    modal.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'nomi-ext-modal-body';
    for (const node of bodyNodes) {
      if (typeof node === 'string') {
        const p = document.createElement('div');
        p.textContent = node;
        p.style.marginBottom = '6px';
        body.appendChild(p);
      } else {
        body.appendChild(node);
      }
    }
    modal.appendChild(body);

    if (actions && actions.length) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'nomi-ext-modal-actions';
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.className = `nomi-ext-modal-btn ${action.className || ''}`;
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          removeModal();
          if (action.onClick) action.onClick();
        });
        actionsDiv.appendChild(btn);
      }
      modal.appendChild(actionsDiv);
    }

    overlay.appendChild(modal);
    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removeModal();
    });
    document.body.appendChild(overlay);
  }

  function removeModal() {
    const existing = document.querySelector('[data-nomi-ext-modal]');
    if (existing) existing.remove();
  }

  // ── Export Flow ──

  async function handleExport() {
    const settings = loadSettings();
    const fmts = settings.exportFormats;
    if (!fmts.txt && !fmts.md && !fmts.csv) {
      showToast('No export formats selected. Open \u2699 Settings to choose a format.', 'error');
      return;
    }

    showToast('Exporting\u2026', 'success', 2000);

    await scrollToRevealAll();
    await sleep(500);

    const data = collectExportData();
    if (data.fieldValues.length === 0) {
      showToast('No text fields found. Make sure the page has loaded.', 'error');
      return;
    }

    const safeName = data.nomiName.replace(/[^a-z0-9]/gi, '_');
    let fileCount = 0;

    if (fmts.txt) {
      download(`${safeName}_Shared_Notes.${data.timestamp}.txt`, buildTxt(data), 'text/plain;charset=utf-8');
      fileCount++;
    }
    if (fmts.md) {
      download(`${safeName}_Shared_Notes.${data.timestamp}.md`, buildMd(data), 'text/markdown;charset=utf-8');
      fileCount++;
    }
    if (fmts.csv) {
      download(`${safeName}_Shared_Notes.${data.timestamp}.csv`, buildCsv(data), 'text/csv;charset=utf-8');
      fileCount++;
    }

    showToast(`Exported ${fileCount} file${fileCount !== 1 ? 's' : ''} to Downloads`, 'success');
  }

  // ── Import Flow ──

  function handleImport() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.md,.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      document.body.removeChild(fileInput);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        const ext = file.name.split('.').pop().toLowerCase();

        let result;
        if (ext === 'txt') result = parseTxtFile(text);
        else if (ext === 'md') result = parseMdFile(text);
        else if (ext === 'csv') result = parseCsvFile(text);
        else {
          showToast(`Unsupported file type ".${ext}". Use .txt, .md, or .csv.`, 'error');
          return;
        }

        if (result.error) {
          showToast(result.error, 'error', 6000);
          return;
        }
        if (!result.fields) {
          showToast('Could not parse the file.', 'error');
          return;
        }

        showImportConfirmation(result.fields, result.warnings, file.name);
      };
      reader.onerror = () => showToast('Could not read the file.', 'error');
      reader.readAsText(file);
    });

    fileInput.click();
  }

  function showImportConfirmation(fields, warnings, filename) {
    const bodyNodes = [];

    const fileDiv = document.createElement('div');
    fileDiv.className = 'nomi-ext-modal-info';
    fileDiv.textContent = `File: ${filename}`;
    bodyNodes.push(fileDiv);

    const filledCount = FIELD_DEFINITIONS.filter(f => fields[f.key] && fields[f.key].trim() !== '').length;
    const countDiv = document.createElement('div');
    countDiv.className = 'nomi-ext-modal-info';
    countDiv.textContent = `${filledCount} of ${FIELD_DEFINITIONS.length} fields have values.`;
    bodyNodes.push(countDiv);

    if (warnings.length > 0) {
      const warnDiv = document.createElement('div');
      warnDiv.className = 'nomi-ext-modal-field-warn';
      warnDiv.textContent = `Missing or empty fields: ${warnings.join(', ')}`;
      bodyNodes.push(warnDiv);
    }

    const warningLines = [
      'This operation is destructive and cannot be undone.',
      'You are responsible for creating a backup of your current Shared Notes before importing.',
      'After import, each section will be expanded automatically. You must press Save in each one to commit the changes.',
    ];
    for (const line of warningLines) {
      const p = document.createElement('div');
      p.className = 'nomi-ext-modal-warning';
      p.textContent = line;
      bodyNodes.push(p);
    }

    showModal('Confirm Import', bodyNodes, [
      {
        label: 'Confirm',
        className: 'nomi-ext-modal-btn-confirm',
        onClick: () => executeImport(fields),
      },
      {
        label: 'Cancel',
        className: 'nomi-ext-modal-btn-cancel',
      },
    ]);
  }

  function expandSection(ta) {
    // Walk up from the textarea looking for a direct-child accordion toggle button.
    // :scope > button limits the search to immediate children only, so we don't
    // accidentally match toggles from sibling or nested sections.
    let el = ta.parentElement;
    let depth = 0;
    while (el && el !== document.body && depth < 12) {
      const collapsed = el.querySelector(':scope > button[aria-expanded="false"]');
      if (collapsed) {
        collapsed.click();
        return;
      }
      // Already expanded at this level — nothing to do.
      if (el.querySelector(':scope > button[aria-expanded="true"]')) return;
      el = el.parentElement;
      depth++;
    }
  }

  function executeImport(fields) {
    const values = FIELD_DEFINITIONS.map(f => fields[f.key] || '');
    const textareas = Array.from(document.querySelectorAll('textarea'));

    if (textareas.length === 0) {
      showToast('No textareas found on page.', 'error');
      return;
    }

    for (let i = 0; i < values.length && i < textareas.length; i++) {
      const ta = textareas[i];
      const previousValue = ta.value.trim();
      const newValue = values[i];
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeSetter.call(ta, newValue);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      if (newValue !== previousValue) expandSection(ta);
    }

    showToast('Import complete. Review each section and press Save.', 'success', 8000);
  }

  // ── Settings Flow ──

  const REPO_URL = 'https://github.com/spacegoblins/nomi.ai-shared-notes-extractor/tree/tampermonkey';

  function showSettings(exportBtn) {
    const settings = loadSettings();
    const bodyNodes = [];

    const desc = document.createElement('div');
    desc.className = 'nomi-ext-settings-desc';
    desc.textContent = 'Select which formats to include when exporting:';
    bodyNodes.push(desc);

    const form = document.createElement('div');
    form.className = 'nomi-ext-settings-form';

    const formats = [
      { key: 'txt', label: 'Plain Text (.txt)' },
      { key: 'md',  label: 'Markdown (.md)' },
      { key: 'csv', label: 'CSV (.csv)' },
    ];

    for (const fmt of formats) {
      const row = document.createElement('label');
      row.className = 'nomi-ext-checkbox-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!settings.exportFormats[fmt.key];
      cb.addEventListener('change', () => {
        settings.exportFormats[fmt.key] = cb.checked;
        // Ensure at least one format stays selected
        const anyChecked = Object.values(settings.exportFormats).some(v => v);
        if (!anyChecked) {
          settings.exportFormats[fmt.key] = true;
          cb.checked = true;
        }
        saveSettings(settings);
        updateExportLabel(exportBtn);
      });

      row.appendChild(cb);
      row.appendChild(document.createTextNode(fmt.label));
      form.appendChild(row);
    }
    bodyNodes.push(form);

    const linkDiv = document.createElement('div');
    const link = document.createElement('a');
    link.href = REPO_URL;
    link.textContent = 'View on GitHub';
    link.className = 'nomi-ext-settings-link';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    linkDiv.appendChild(link);
    bodyNodes.push(linkDiv);

    showModal('Export Settings', bodyNodes, []);
  }

  // ── Button Injection ──

  const HEADER_SELECTOR = 'header.ChatSubPage_header__fGTaa';
  const BUTTON_GROUP_ID = 'nomi-ext-btn-group';

  function updateExportLabel(btn) {
    const settings = loadSettings();
    const labels = getSelectedFormatLabels(settings);
    btn.textContent = `Export [${labels.join(', ')}]`;
  }

  function injectButtons() {
    // Don't inject if already present
    if (document.getElementById(BUTTON_GROUP_ID)) return;

    const header = document.querySelector(HEADER_SELECTOR);
    if (!header) return;

    const group = document.createElement('div');
    group.className = 'nomi-ext-btn-group';
    group.id = BUTTON_GROUP_ID;

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'nomi-ext-btn nomi-ext-btn-settings';
    settingsBtn.textContent = '\u2699';
    settingsBtn.title = 'Export Settings';

    const importBtn = document.createElement('button');
    importBtn.className = 'nomi-ext-btn nomi-ext-btn-import';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', handleImport);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'nomi-ext-btn nomi-ext-btn-export';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', handleExport);

    // Wire settings button now that exportBtn exists
    settingsBtn.addEventListener('click', () => showSettings(exportBtn));

    // Set initial export label
    updateExportLabel(exportBtn);

    const divider = document.createElement('span');
    divider.className = 'nomi-ext-divider';
    divider.textContent = '|';

    group.appendChild(divider);
    group.appendChild(settingsBtn);
    group.appendChild(importBtn);
    group.appendChild(exportBtn);
    header.appendChild(group);
  }

  function removeButtons() {
    const group = document.getElementById(BUTTON_GROUP_ID);
    if (group) group.remove();
  }

  // ── SPA Navigation Handling ──

  function isSharedNotesPage() {
    return /\/nomis\/\d+\/shared-notes/.test(window.location.pathname);
  }

  let lastUrl = window.location.href;

  function checkForNavigation() {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;

    if (isSharedNotesPage()) {
      // Re-inject after SPA navigation back to shared notes
      waitForHeaderAndInject();
    } else {
      // Navigated away — clean up
      removeButtons();
      removeModal();
    }
  }

  function waitForHeaderAndInject() {
    // Header may not exist yet — use MutationObserver to wait
    if (document.querySelector(HEADER_SELECTOR)) {
      injectButtons();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(HEADER_SELECTOR)) {
        observer.disconnect();
        injectButtons();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Safety timeout — stop watching after 15s
    setTimeout(() => observer.disconnect(), 15000);
  }

  // ── Init ──

  // Poll for URL changes (catches SPA navigation that doesn't trigger popstate)
  setInterval(checkForNavigation, 500);

  // Initial injection
  waitForHeaderAndInject();

})();