// inject.js — auto-injected content script for Shared Notes pages
// Adds Import/Export buttons to the page header and handles all import/export logic in-page.

(function () {
  'use strict';

  // Guard: don't inject twice
  if (window.__nomiExtInjected) return;
  window.__nomiExtInjected = true;

  // ── Field Definitions ──

  const FIELD_DEFINITIONS = [
    { key: 'backstory',            label: 'BACKSTORY' },
    { key: 'inclination',          label: 'INCLINATION' },
    { key: 'currentRoleplay',      label: 'CURRENT ROLEPLAY' },
    { key: 'yourAppearance',       label: 'YOUR APPEARANCE' },
    { key: 'nomiAppearance',       label: "NOMI'S APPEARANCE" },
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

  async function loadSettings() {
    try {
      const stored = await browser.storage.sync.get('settings');
      if (stored.settings) {
        return Object.assign(structuredClone(DEFAULT_SETTINGS), stored.settings);
      }
    } catch (e) { /* storage unavailable */ }
    return structuredClone(DEFAULT_SETTINGS);
  }

  function getSelectedFormatLabels(settings) {
    const labels = [];
    if (settings.exportFormats.txt) labels.push('.txt');
    if (settings.exportFormats.md) labels.push('.md');
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

  // Match a textarea to its Shared Notes field by walking up to its accordion
  // panel and reading the title from the associated control button. This is
  // identity-based, so positional order no longer matters: stray textareas
  // elsewhere on the page and section reordering can't misalign fields (the
  // old code matched purely by DOM order).
  function getFieldForTextarea(ta) {
    const panel = ta.closest('[role="region"]');
    if (!panel) return null;
    const controlId = panel.getAttribute('aria-labelledby');
    if (!controlId) return null;
    const control = document.getElementById(controlId);
    if (!control) return null;
    const titleEl = control.querySelector('[data-size="xl"]');
    const upper = (titleEl ? titleEl.textContent : '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    for (const field of FIELD_DEFINITIONS) {
      if (field.key === 'nomiAppearance') {
        // Label is dynamic ("Sayumi's Appearance", "James' Appearance", ...).
        if (upper.endsWith('APPEARANCE') && upper !== 'YOUR APPEARANCE') return field;
      } else if (upper === field.label) {
        return field;
      }
    }
    return null;
  }

  // Collect field values in FIELD_DEFINITIONS order, ignoring stray textareas
  // that don't map to a field. Values are preserved as-is (no trimming) so
  // intentional leading/trailing whitespace survives a round-trip. Also reports
  // which fields were genuinely missing so the export can warn meaningfully.
  function collectFieldValues() {
    const byKey = {};
    const found = new Set();
    for (const ta of document.querySelectorAll('textarea')) {
      const field = getFieldForTextarea(ta);
      if (field) {
        byKey[field.key] = ta.value;
        found.add(field.key);
      }
    }
    return {
      values: FIELD_DEFINITIONS.map(f => byKey[f.key] || ''),
      missing: FIELD_DEFINITIONS.filter(f => !found.has(f.key)).map(f => f.label),
    };
  }

  function collectExportData() {
    const nomiName = getNomiName();
    const nomiId = getNomiId();
    const { values, missing } = collectFieldValues();
    const timestamp = getTimestamp();
    const now = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return { nomiName, nomiId, fieldValues: values, missingFields: missing, timestamp, now };
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
    if (data.missingFields.length) {
      lines.push(`\u26A0 WARNING: Could not find fields: ${data.missingFields.join(', ')}`);
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
    // Defer revoking so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    const settings = await loadSettings();
    const fmts = settings.exportFormats;
    if (!fmts.txt && !fmts.md && !fmts.csv) {
      showToast('No export formats selected. Open ⚙ Settings in the page header.', 'error');
      return;
    }

    showToast('Exporting\u2026', 'success', 2000);

    await scrollToRevealAll();
    await sleep(500);

    const data = collectExportData();
    if (data.missingFields.length === FIELD_DEFINITIONS.length) {
      showToast('No Shared Notes fields found. Make sure the page has loaded.', 'error');
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

    // File info
    const fileDiv = document.createElement('div');
    fileDiv.className = 'nomi-ext-modal-info';
    fileDiv.textContent = `File: ${filename}`;
    bodyNodes.push(fileDiv);

    // Field count
    const filledCount = FIELD_DEFINITIONS.filter(f => fields[f.key] && fields[f.key].trim() !== '').length;
    const countDiv = document.createElement('div');
    countDiv.className = 'nomi-ext-modal-info';
    countDiv.textContent = `${filledCount} of ${FIELD_DEFINITIONS.length} fields have values.`;
    bodyNodes.push(countDiv);

    // Warnings for missing fields
    if (warnings.length > 0) {
      const warnDiv = document.createElement('div');
      warnDiv.className = 'nomi-ext-modal-field-warn';
      warnDiv.textContent = `Missing or empty fields: ${warnings.join(', ')}`;
      bodyNodes.push(warnDiv);
    }

    // Destructive warnings
    const warningLines = [
      'This operation is destructive and cannot be undone.',
      'You are responsible for creating a backup of your current Shared Notes before importing.',
      'After import, each section with changes will be expanded automatically. You must press Save in each one to commit the changes.',
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
    // :scope > button limits the search to immediate children, so we don't
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
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;

    let filled = 0;
    for (const ta of document.querySelectorAll('textarea')) {
      // Fill each field's own textarea (matched by identity), so stray
      // textareas on the page are left untouched.
      const field = getFieldForTextarea(ta);
      if (!field) continue;
      const newValue = fields[field.key] || '';
      const previousValue = ta.value.trim();
      nativeSetter.call(ta, newValue);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      if (newValue.trim() !== previousValue) expandSection(ta);
      filled++;
    }

    if (filled === 0) {
      showToast('No Shared Notes fields found on page.', 'error');
      return;
    }

    showToast(
      'Import complete. Review each section and press Save.',
      'success', 8000
    );
  }

  // ── Settings / About Modal ──

  const REPO_URL = 'https://github.com/spacegoblins/nomi.ai-shared-notes-extractor';
  const RELEASES_API_URL = 'https://api.github.com/repos/spacegoblins/nomi.ai-shared-notes-extractor/releases/latest';

  async function showSettings(exportBtn) {
    const settings = await loadSettings();

    // ── Build modal body content ──
    const container = document.createElement('div');

    // Tab bar
    const tabs = document.createElement('div');
    tabs.className = 'nomi-ext-modal-tabs';

    const settingsTabBtn = document.createElement('button');
    settingsTabBtn.className = 'nomi-ext-modal-tab nomi-ext-modal-tab--active';
    settingsTabBtn.textContent = 'Settings';

    const aboutTabBtn = document.createElement('button');
    aboutTabBtn.className = 'nomi-ext-modal-tab';
    aboutTabBtn.textContent = 'About';

    tabs.appendChild(settingsTabBtn);
    tabs.appendChild(aboutTabBtn);
    container.appendChild(tabs);

    // Tab content area
    const tabContent = document.createElement('div');
    container.appendChild(tabContent);

    function renderSettingsTab() {
      settingsTabBtn.classList.add('nomi-ext-modal-tab--active');
      aboutTabBtn.classList.remove('nomi-ext-modal-tab--active');
      tabContent.textContent = '';

      const desc = document.createElement('div');
      desc.className = 'nomi-ext-settings-desc';
      desc.textContent = 'Select which formats to include when exporting:';
      tabContent.appendChild(desc);

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
        cb.addEventListener('change', async () => {
          settings.exportFormats[fmt.key] = cb.checked;
          const anyChecked = Object.values(settings.exportFormats).some(v => v);
          if (!anyChecked) {
            settings.exportFormats[fmt.key] = true;
            cb.checked = true;
          }
          try {
            await browser.storage.sync.set({ settings });
          } catch (e) { /* storage unavailable */ }
          updateExportLabel(exportBtn);
        });

        row.appendChild(cb);
        row.appendChild(document.createTextNode(fmt.label));
        form.appendChild(row);
      }
      tabContent.appendChild(form);
    }

    function renderAboutTab() {
      aboutTabBtn.classList.add('nomi-ext-modal-tab--active');
      settingsTabBtn.classList.remove('nomi-ext-modal-tab--active');
      tabContent.textContent = '';

      const loadingMsg = document.createElement('div');
      loadingMsg.className = 'nomi-ext-modal-info';
      loadingMsg.textContent = 'Fetching release info…';
      tabContent.appendChild(loadingMsg);

      fetch(RELEASES_API_URL, { headers: { 'Accept': 'application/vnd.github.v3+json' } })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(release => {
          tabContent.textContent = '';

          const versionDiv = document.createElement('div');
          versionDiv.className = 'nomi-ext-about-version';
          versionDiv.textContent = `Version: ${release.tag_name || release.name || 'unknown'}`;
          tabContent.appendChild(versionDiv);

          if (release.published_at) {
            const date = new Date(release.published_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            });
            const dateDiv = document.createElement('div');
            dateDiv.className = 'nomi-ext-about-date';
            dateDiv.textContent = `Released: ${date}`;
            tabContent.appendChild(dateDiv);
          }

          if (release.body) {
            const notesLabel = document.createElement('div');
            notesLabel.className = 'nomi-ext-about-notes-label';
            notesLabel.textContent = 'Release Notes:';
            tabContent.appendChild(notesLabel);

            const notesBody = document.createElement('div');
            notesBody.className = 'nomi-ext-about-notes-body';
            notesBody.textContent = release.body;
            tabContent.appendChild(notesBody);
          }

          appendRepoLink(tabContent);
        })
        .catch(() => {
          tabContent.textContent = '';

          const manifest = browser.runtime.getManifest();
          const versionDiv = document.createElement('div');
          versionDiv.className = 'nomi-ext-about-version';
          versionDiv.textContent = `Version: ${manifest.version}`;
          tabContent.appendChild(versionDiv);

          const failMsg = document.createElement('div');
          failMsg.className = 'nomi-ext-modal-info';
          failMsg.textContent = 'Could not fetch release info.';
          tabContent.appendChild(failMsg);

          appendRepoLink(tabContent);
        });
    }

    function appendRepoLink(parent) {
      const linkDiv = document.createElement('div');
      linkDiv.style.marginTop = '8px';
      const link = document.createElement('a');
      link.href = REPO_URL;
      link.textContent = 'View on GitHub';
      link.className = 'nomi-ext-settings-link';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      linkDiv.appendChild(link);
      parent.appendChild(linkDiv);
    }

    settingsTabBtn.addEventListener('click', renderSettingsTab);
    aboutTabBtn.addEventListener('click', renderAboutTab);

    // Render initial tab
    renderSettingsTab();

    showModal('Nomi.AI Shared Notes Extractor', [container], [
      { label: 'Close', className: 'nomi-ext-modal-btn-cancel' },
    ]);
  }

  // ── Button Injection ──

  const HEADER_SELECTOR = 'header.ChatSubPage_header__fGTaa';
  const BUTTON_GROUP_ID = 'nomi-ext-btn-group';

  async function updateExportLabel(btn) {
    const settings = await loadSettings();
    const labels = getSelectedFormatLabels(settings);
    btn.textContent = `Export [${labels.join(', ')}]`;
  }

  // Register the settings-change listener once. Re-injecting buttons on SPA
  // navigation would otherwise accumulate duplicate listeners, each holding a
  // stale reference to a detached button.
  let storageListenerRegistered = false;
  function registerStorageListener() {
    if (storageListenerRegistered) return;
    storageListenerRegistered = true;
    browser.storage.onChanged.addListener((changes) => {
      if (!changes.settings) return;
      const btn = document.querySelector('.nomi-ext-btn-export');
      if (btn) updateExportLabel(btn);
    });
  }

  function injectButtons() {
    // Don't inject if already present
    if (document.getElementById(BUTTON_GROUP_ID)) return;

    const header = document.querySelector(HEADER_SELECTOR);
    if (!header) return;

    const group = document.createElement('div');
    group.className = 'nomi-ext-btn-group';
    group.id = BUTTON_GROUP_ID;

    const exportBtn = document.createElement('button');
    exportBtn.className = 'nomi-ext-btn nomi-ext-btn-export';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', handleExport);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'nomi-ext-btn nomi-ext-btn-settings';
    settingsBtn.textContent = '⚙';
    settingsBtn.title = 'Export Settings';
    settingsBtn.addEventListener('click', () => showSettings(exportBtn));

    const importBtn = document.createElement('button');
    importBtn.className = 'nomi-ext-btn nomi-ext-btn-import';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', handleImport);

    // Load the label with format info
    updateExportLabel(exportBtn);

    // Listen for settings changes to update the label (registered once)
    registerStorageListener();

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
    const urlChanged = currentUrl !== lastUrl;
    if (urlChanged) lastUrl = currentUrl;

    if (isSharedNotesPage()) {
      // Re-inject on URL change, or if React hydration removed our buttons
      if (urlChanged || !document.getElementById(BUTTON_GROUP_ID)) {
        waitForHeaderAndInject();
      }
    } else if (urlChanged) {
      // Navigated away — clean up
      removeButtons();
      removeModal();
    }
  }

  // Kept as module-level so we never stack duplicate observers
  let headerObserver = null;

  function waitForHeaderAndInject() {
    // Header may not exist yet — use MutationObserver to wait
    if (document.querySelector(HEADER_SELECTOR)) {
      injectButtons();
      return;
    }

    // Already waiting — don't create a second observer
    if (headerObserver) return;

    headerObserver = new MutationObserver(() => {
      if (document.querySelector(HEADER_SELECTOR)) {
        headerObserver.disconnect();
        headerObserver = null;
        injectButtons();
      }
    });
    headerObserver.observe(document.body, { childList: true, subtree: true });

    // Safety timeout — stop watching after 15s
    setTimeout(() => {
      if (headerObserver) {
        headerObserver.disconnect();
        headerObserver = null;
      }
    }, 15000);
  }

  // ── Init ──

  // Poll for URL changes (catches SPA navigation that doesn't trigger popstate)
  setInterval(checkForNavigation, 500);

  // Initial injection (only if already on a shared-notes page)
  if (isSharedNotesPage()) {
    waitForHeaderAndInject();
  }

})();
