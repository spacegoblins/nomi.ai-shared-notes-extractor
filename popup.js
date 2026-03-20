// popup.js — toolbar popup UI, built with safe DOM methods (no innerHTML)
// v1.3 — multi-format export, import, settings, about panel

const content = document.getElementById('content');
const buttonBar = document.getElementById('button-bar');
let resultTimeout = null;
let currentView = 'main'; // 'main' | 'settings' | 'about'
let isImportMode = false;

// -- Settings --

const DEFAULT_SETTINGS = {
  exportFormats: { txt: true, md: false, csv: false },
  // Future options (not yet visible in UI):
  // embedNomiUuid: false,
  // embedInPage: false,
  // useCloudStorage: false,
};

let settings = structuredClone(DEFAULT_SETTINGS);

async function loadSettings() {
  try {
    const stored = await browser.storage.sync.get('settings');
    if (stored.settings) {
      settings = Object.assign(structuredClone(DEFAULT_SETTINGS), stored.settings);
    }
  } catch (e) {
    // storage unavailable — keep defaults
  }
}

async function saveSettings() {
  try {
    await browser.storage.sync.set({ settings });
  } catch (e) {
    // storage unavailable — silently fail
  }
}

function getSelectedFormatLabels() {
  const labels = [];
  if (settings.exportFormats.txt) labels.push('.txt');
  if (settings.exportFormats.md) labels.push('.md');
  if (settings.exportFormats.csv) labels.push('.csv');
  return labels;
}

function getExportButtonLabel() {
  const labels = getSelectedFormatLabels();
  return `Export [${labels.join(', ')}]`;
}

// -- URL Helpers --

function getNomiIdFromUrl(url) {
  const match = url.match(/\/nomis\/(\d+)/);
  return match ? match[1] : null;
}

function isSharedNotesPage(url) {
  return /\/nomis\/\d+\/shared-notes/.test(url);
}

function isChatPage(url) {
  return /\/nomis\/\d+\/?$/.test(url);
}

function isNomiAi(url) {
  return /https?:\/\/(beta\.)?nomi\.ai/.test(url);
}

// -- DOM Helpers --

function render(...nodes) {
  content.textContent = '';
  nodes.forEach(n => content.appendChild(n));
}

function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

function statusBox(type, labelText, ...bodyChildren) {
  const box = el('div', `status-box ${type}`);
  const label = el('div', 'label');
  if (type === 'working') {
    label.appendChild(el('span', 'spinner'));
    label.appendChild(document.createTextNode(' ' + labelText));
  } else {
    label.textContent = labelText;
  }
  box.appendChild(label);
  for (const child of bodyChildren) {
    if (typeof child === 'string') box.appendChild(document.createTextNode(child));
    else if (child) box.appendChild(child);
  }
  return box;
}

function makeButton(className, id, text) {
  const button = document.createElement('button');
  button.className = className;
  button.id = id;
  button.textContent = text;
  return button;
}

// -- Button Bar --

function renderButtonBar(view) {
  buttonBar.textContent = '';
  if (view === 'settings' || view === 'about') {
    const homeBtn = document.createElement('button');
    homeBtn.className = 'btn-capsule';
    homeBtn.textContent = 'Home';
    homeBtn.addEventListener('click', () => {
      currentView = 'main';
      renderButtonBar('main');
      init();
    });
    buttonBar.appendChild(homeBtn);
  } else {
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn-capsule';
    settingsBtn.textContent = 'Settings';
    settingsBtn.addEventListener('click', () => {
      currentView = 'settings';
      renderButtonBar('settings');
      renderSettingsPanel();
    });

    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'btn-capsule';
    aboutBtn.textContent = 'About';
    aboutBtn.addEventListener('click', () => {
      currentView = 'about';
      renderButtonBar('about');
      renderAboutPanel();
    });

    buttonBar.appendChild(settingsBtn);
    buttonBar.appendChild(aboutBtn);
  }
}

// -- Panels --

function renderSettingsPanel() {
  const container = el('div', null);

  const heading = el('div', 'label');
  heading.textContent = 'EXPORT FORMATS';
  heading.style.marginBottom = '10px';
  heading.style.fontSize = '10px';
  heading.style.fontWeight = '700';
  heading.style.letterSpacing = '0.08em';
  heading.style.color = '#a1a1aa';
  container.appendChild(heading);

  const formats = [
    { key: 'txt', label: '.txt — Plain text' },
    { key: 'md',  label: '.md — Markdown' },
    { key: 'csv', label: '.csv — Spreadsheet' },
  ];

  const checkboxes = [];

  for (const fmt of formats) {
    const row = document.createElement('label');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0',
      fontSize: '12px',
      color: '#e4e4e7',
      cursor: 'pointer',
    });

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = settings.exportFormats[fmt.key];
    cb.dataset.format = fmt.key;
    checkboxes.push(cb);

    cb.addEventListener('change', () => {
      const checkedCount = checkboxes.filter(c => c.checked).length;
      if (checkedCount === 0) {
        // Prevent unchecking the last one
        cb.checked = true;
        return;
      }
      settings.exportFormats[fmt.key] = cb.checked;
      saveSettings();
    });

    row.appendChild(cb);
    row.appendChild(document.createTextNode(fmt.label));
    container.appendChild(row);
  }

  const note = document.createElement('div');
  Object.assign(note.style, {
    fontSize: '10px',
    color: '#71717a',
    marginTop: '10px',
    lineHeight: '1.4',
  });
  note.textContent = 'At least one format must be selected. Settings sync across devices via your Firefox account.';
  container.appendChild(note);

  render(
    statusBox('ready', 'Settings', container)
  );
}

function renderAboutPanel() {
  const container = el('div', null);

  // Show loading state while fetching
  const loadingMsg = el('div', null, 'Fetching release info\u2026');
  Object.assign(loadingMsg.style, { fontSize: '11px', color: '#a1a1aa' });
  container.appendChild(loadingMsg);

  render(statusBox('ready', 'About', container));

  const REPO_URL = 'https://github.com/spacegoblins/nomi.ai-shared-notes-extractor';
  const API_URL = 'https://api.github.com/repos/spacegoblins/nomi.ai-shared-notes-extractor/releases/latest';

  fetch(API_URL, { headers: { 'Accept': 'application/vnd.github.v3+json' } })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(release => {
      container.textContent = '';

      // Version
      const versionDiv = el('div', null, `Version: ${release.tag_name || release.name || 'unknown'}`);
      Object.assign(versionDiv.style, { fontSize: '12px', fontWeight: '600', color: '#e4e4e7', marginBottom: '4px' });
      container.appendChild(versionDiv);

      // Release date
      if (release.published_at) {
        const date = new Date(release.published_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        const dateDiv = el('div', null, `Released: ${date}`);
        Object.assign(dateDiv.style, { fontSize: '11px', color: '#a1a1aa', marginBottom: '10px' });
        container.appendChild(dateDiv);
      }

      // Changelog / release notes body
      if (release.body) {
        const notesLabel = el('div', null, 'Release Notes:');
        Object.assign(notesLabel.style, { fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', color: '#a1a1aa', marginBottom: '4px' });
        container.appendChild(notesLabel);

        const notesBody = el('div', null, release.body);
        Object.assign(notesBody.style, {
          fontSize: '11px',
          color: '#d4d4d8',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          maxHeight: '120px',
          overflowY: 'auto',
          marginBottom: '10px',
        });
        container.appendChild(notesBody);
      }

      // Repo link
      appendRepoLink(container, REPO_URL);
    })
    .catch(() => {
      container.textContent = '';

      // Fallback: show version from manifest
      const manifest = browser.runtime.getManifest();
      const versionDiv = el('div', null, `Version: ${manifest.version}`);
      Object.assign(versionDiv.style, { fontSize: '12px', fontWeight: '600', color: '#e4e4e7', marginBottom: '8px' });
      container.appendChild(versionDiv);

      const failMsg = el('div', null, 'Could not fetch release info \u2014 please visit ');
      Object.assign(failMsg.style, { fontSize: '11px', color: '#71717a', marginBottom: '10px' });

      const fallbackLink = document.createElement('a');
      fallbackLink.href = `${REPO_URL}/releases/latest`;
      fallbackLink.textContent = 'GitHub';
      Object.assign(fallbackLink.style, { color: '#818cf8', textDecoration: 'underline' });
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noopener noreferrer';
      failMsg.appendChild(fallbackLink);

      container.appendChild(failMsg);

      // Repo link
      appendRepoLink(container, REPO_URL);
    });
}

function appendRepoLink(container, url) {
  const linkDiv = document.createElement('div');
  Object.assign(linkDiv.style, { marginTop: '6px' });

  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'View on GitHub';
  Object.assign(link.style, { fontSize: '11px', color: '#818cf8', textDecoration: 'underline' });
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  linkDiv.appendChild(link);
  container.appendChild(linkDiv);
}

// -- Import --

const FIELD_DEFINITIONS = [
  { key: 'backstory',           label: 'BACKSTORY' },
  { key: 'inclination',         label: 'INCLINATION' },
  { key: 'currentRoleplay',     label: 'CURRENT ROLEPLAY' },
  { key: 'yourAppearance',      label: 'YOUR APPEARANCE' },
  { key: 'nomiAppearance',      label: "NOMI'S APPEARANCE" },
  { key: 'appearanceTendencies',label: 'APPEARANCE TENDENCIES' },
  { key: 'nicknames',           label: 'NICKNAMES' },
  { key: 'preferences',         label: 'PREFERENCES' },
  { key: 'desires',             label: 'DESIRES' },
  { key: 'boundaries',          label: 'BOUNDARIES' },
];

// CSV header keys (must match content.js buildCsv output)
const CSV_FIELD_KEYS = FIELD_DEFINITIONS.map(f =>
  f.key.replace(/([A-Z])/g, '_$1').toLowerCase()
);

// --- Parsers ---

function parseTxtFile(text) {
  const fields = {};
  const warnings = [];

  for (const field of FIELD_DEFINITIONS) {
    // Match "LABEL:" followed by a backtick-wrapped value or "(empty)" on next line
    const pattern = new RegExp(
      `^${escapeRegex(field.label)}:\\s*\\n` +
      `(?:\`([\\s\\S]*?)\`|\\(empty\\))`,
      'm'
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

  for (let i = 0; i < FIELD_DEFINITIONS.length; i++) {
    const field = FIELD_DEFINITIONS[i];
    // Match "## LABEL" heading and capture body text until next ## or end
    const headingPattern = new RegExp(
      `^## ${escapeRegex(field.label)}\\s*$`,
      'm'
    );
    const match = headingPattern.exec(text);
    if (match) {
      const startIdx = match.index + match[0].length;
      // Find next ## heading or end of string
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
  // Rejoin remaining lines for data row parsing (values may contain newlines)
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

// Parse a single CSV row respecting quoted fields with newlines/commas/escaped quotes
function parseCsvRow(text) {
  const result = [];
  let i = 0;
  while (i <= text.length) {
    if (i === text.length) { result.push(''); break; }
    if (text[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < text.length) {
        if (text[i] === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += text[i];
          i++;
        }
      }
      result.push(value);
      // Skip comma or end
      if (i < text.length && text[i] === ',') i++;
      else break;
    } else {
      // Unquoted field
      const nextComma = text.indexOf(',', i);
      const nextNewline = text.indexOf('\n', i);
      let end;
      if (nextComma === -1) end = text.length;
      else if (nextNewline !== -1 && nextNewline < nextComma) end = text.length; // shouldn't happen for header
      else end = nextComma;
      result.push(text.substring(i, end));
      i = end + 1;
      if (end === text.length) break;
    }
  }
  return result;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Import Flow ---

function handleImport(tabId) {
  // Firefox closes the popup when an OS file dialog opens (focus loss).
  // Workaround: re-open popup.html as a regular tab where dialogs work.
  const url = browser.runtime.getURL('popup.html') + '?import=' + tabId;
  browser.tabs.create({ url });
  window.close();
}

function startImportMode(tabId) {
  isImportMode = true;
  document.body.classList.add('import-mode');
  buttonBar.style.display = 'none';
  // Hide both dividers (above and below button bar)
  document.querySelectorAll('.divider').forEach(d => d.style.display = 'none');

  // Cannot auto-open file picker — browsers require a user gesture.
  // Show a button the user clicks to trigger the picker.
  showImportPickerFallback(tabId);
}

function openImportFilePicker(tabId) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.md,.csv';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    document.body.removeChild(fileInput);
    if (!file) {
      showImportPickerFallback(tabId);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const ext = file.name.split('.').pop().toLowerCase();

      let result;
      if (ext === 'txt') {
        result = parseTxtFile(text);
      } else if (ext === 'md') {
        result = parseMdFile(text);
      } else if (ext === 'csv') {
        result = parseCsvFile(text);
      } else {
        render(statusBox('warning', 'Unsupported Format', `File type ".${ext}" is not supported. Use .txt, .md, or .csv.`));
        return;
      }

      if (result.error) {
        render(statusBox('warning', 'Parse Error', result.error));
        return;
      }

      if (!result.fields) {
        render(statusBox('warning', 'Parse Error', 'Could not parse the file.'));
        return;
      }

      showImportConfirmation(tabId, result.fields, result.warnings, file.name);
    };

    reader.onerror = () => {
      render(statusBox('warning', 'Read Error', 'Could not read the selected file.'));
    };

    reader.readAsText(file);
  });

  fileInput.click();
}

function showImportPickerFallback(tabId) {
  const retryBtn = makeButton('btn-import', 'btn-retry-import', 'Select File');
  const closeBtn = makeButton('btn-navigate', 'btn-close-import', 'Cancel');
  closeBtn.style.marginTop = '8px';
  render(
    statusBox('ready', 'Import', 'Choose a .txt, .md, or .csv file exported by this extension.'),
    retryBtn,
    closeBtn
  );
  retryBtn.addEventListener('click', () => openImportFilePicker(tabId));
  closeBtn.addEventListener('click', () => window.close());
}

function showImportConfirmation(tabId, fields, warnings, filename) {
  const container = el('div', null);

  // File info
  const fileInfo = el('div', null, `File: ${filename}`);
  Object.assign(fileInfo.style, { fontSize: '12px', fontWeight: '600', color: '#e4e4e7', marginBottom: '8px' });
  container.appendChild(fileInfo);

  // Warnings for missing fields
  if (warnings.length > 0) {
    const warnDiv = el('div', null);
    Object.assign(warnDiv.style, { fontSize: '11px', color: '#fcd34d', marginBottom: '8px', lineHeight: '1.4' });
    warnDiv.appendChild(document.createTextNode(`Missing or empty fields: ${warnings.join(', ')}`));
    container.appendChild(warnDiv);
  }

  // Field count
  const filledCount = FIELD_DEFINITIONS.filter(f => fields[f.key] && fields[f.key].trim() !== '').length;
  const countDiv = el('div', null, `${filledCount} of ${FIELD_DEFINITIONS.length} fields have values.`);
  Object.assign(countDiv.style, { fontSize: '11px', color: '#a1a1aa', marginBottom: '12px' });
  container.appendChild(countDiv);

  // Warning messages
  const warningLines = [
    'This operation is destructive and cannot be undone.',
    'You are responsible for creating a backup of your current Shared Notes before importing.',
    'After import, you must expand each section and manually press Save to commit the changes. Any section you do not Save will not be applied.',
  ];

  for (const line of warningLines) {
    const p = el('div', null, line);
    Object.assign(p.style, { fontSize: '11px', color: '#fca5a5', lineHeight: '1.4', marginBottom: '6px' });
    container.appendChild(p);
  }

  render(statusBox('warning', 'Confirm Import', container));

  // Confirm / Cancel buttons
  const confirmBtn = makeButton('btn-import', 'btn-confirm-import', 'Confirm');
  const cancelBtn = makeButton('btn-navigate', 'btn-cancel-import', 'Cancel');
  cancelBtn.style.marginTop = '8px';

  content.appendChild(confirmBtn);
  content.appendChild(cancelBtn);

  confirmBtn.addEventListener('click', () => executeImport(tabId, fields));
  cancelBtn.addEventListener('click', () => {
    if (isImportMode) window.close();
    else init();
  });
}

async function executeImport(tabId, fields) {
  render(statusBox('working', 'Importing\u2026', 'Writing values to Shared Notes fields, please wait.'));

  try {
    // Build an ordered array of values matching textarea order
    const values = FIELD_DEFINITIONS.map(f => fields[f.key] || '');
    const payload = JSON.stringify(values);

    // Inject the import data and writer script
    await browser.tabs.executeScript(tabId, {
      code: `window.__nomiImportData = ${payload};`
    });

    await browser.tabs.executeScript(tabId, {
      code: `
        (function() {
          const values = window.__nomiImportData;
          if (!values) return { success: false, error: 'No import data found.' };

          const textareas = Array.from(document.querySelectorAll('textarea'));
          if (textareas.length === 0) return { success: false, error: 'No textareas found on page.' };

          let written = 0;
          for (let i = 0; i < values.length && i < textareas.length; i++) {
            const ta = textareas[i];
            // Set the value via native setter to bypass React's synthetic state
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeSetter.call(ta, values[i]);

            // Dispatch events to trigger React state detection
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            written++;
          }

          window.__nomiImportData = null;
          return { success: true, written: written };
        })()
      `
    }).then(results => {
      const result = results[0];
      if (result && result.success) {
        showImportResult(true, result.written);
      } else {
        showImportResult(false, 0, result ? result.error : 'No response from import script.');
      }
    });

  } catch (err) {
    showImportResult(false, 0, err.message || 'Import failed.');
  }
}

function showImportResult(success, written, error) {
  if (success) {
    const container = el('div', null);

    const msg = el('div', null, `${written} field${written !== 1 ? 's' : ''} written successfully.`);
    Object.assign(msg.style, { fontSize: '12px', color: '#86efac', marginBottom: '8px' });
    container.appendChild(msg);

    const reminder = el('div', null, 'Remember: expand each section on the page and press Save to commit your changes.');
    Object.assign(reminder.style, { fontSize: '11px', color: '#a1a1aa', lineHeight: '1.4' });
    container.appendChild(reminder);

    render(
      el('div', 'status-box ready',
        el('div', 'success-check', 'Import Complete'),
        container
      )
    );
    if (isImportMode) {
      const closeBtn = makeButton('btn-navigate', 'btn-close-tab', 'Close');
      closeBtn.style.marginTop = '8px';
      content.appendChild(closeBtn);
      closeBtn.addEventListener('click', () => window.close());
    }
  } else {
    const retryBtn = makeButton('btn-navigate', 'btn-retry', 'Try Again');
    render(
      statusBox('warning', 'Import failed', error || 'Could not write to the Shared Notes fields.'),
      retryBtn
    );
    retryBtn.addEventListener('click', () => {
      if (isImportMode) window.close();
      else init();
    });
  }
}

// -- Timeout Safety --

function startResultTimeout(ms) {
  clearResultTimeout();
  resultTimeout = setTimeout(() => {
    const retryBtn = makeButton('btn-navigate', 'btn-retry', 'Try Again');
    render(
      statusBox('warning', 'Timeout', 'The operation took too long. Please try again.'),
      retryBtn
    );
    retryBtn.addEventListener('click', init);
  }, ms);
}

function clearResultTimeout() {
  if (resultTimeout) {
    clearTimeout(resultTimeout);
    resultTimeout = null;
  }
}

// -- Tab Helpers --

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Poll-based tab load wait — avoids event listener issues in popup context.
// First waits for tab to enter 'loading' (so we don't see the old page's 'complete'),
// then waits for 'complete'.
async function waitForTabLoad(tabId, timeoutMs) {
  const start = Date.now();

  // Phase 1: wait for navigation to begin (status leaves 'complete')
  while (Date.now() - start < timeoutMs) {
    const tab = await browser.tabs.get(tabId);
    if (tab.status === 'loading') break;
    await sleep(100);
  }

  // Phase 2: wait for page to finish loading
  while (Date.now() - start < timeoutMs) {
    const tab = await browser.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await sleep(250);
  }

  throw new Error('Page load timed out.');
}

// Poll until at least one textarea appears, signaling React has rendered
async function waitForTextareas(tabId, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const results = await browser.tabs.executeScript(tabId, {
        code: 'document.querySelectorAll("textarea").length'
      });
      if (results[0] > 0) return;
    } catch (e) {
      // Page may not be ready for script injection yet — keep polling
    }
    await sleep(500);
  }
}

// Poll for the result that content.js writes to window.__nomiExportResult
async function pollForExportResult(tabId, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const results = await browser.tabs.executeScript(tabId, {
        code: 'window.__nomiExportResult'
      });
      if (results[0]) return results[0];
    } catch (e) {
      // Ignore — script may not be ready yet
    }
    await sleep(300);
  }
  return null;
}

// -- Main --

async function init() {
  clearResultTimeout();
  currentView = 'main';
  renderButtonBar('main');
  await loadSettings();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';

  if (!isNomiAi(url)) {
    render(
      statusBox('warning', 'Nomi Not Found',
        'Navigate to a Nomi\'s private chat or Shared Notes page on beta.nomi.ai, then try again.'
      )
    );
    return;
  }

  if (isSharedNotesPage(url)) {
    // Get the Nomi name from the page title
    let nomiName = 'your Nomi';
    try {
      const results = await browser.tabs.executeScript(tab.id, {
        code: `(function() {
          const parts = document.title.split('|').map(s => s.trim());
          for (const p of parts) {
            if (p && !/shared notes/i.test(p) && !/nomi\\.ai/i.test(p)) return p;
          }
          return null;
        })()`
      });
      if (results[0]) nomiName = results[0];
    } catch (e) {}

    const importBtn = makeButton('btn-import', 'btn-import', 'Import');
    const exportBtn = makeButton('btn-export', 'btn-export', getExportButtonLabel());

    render(
      statusBox('ready', 'Ready to Export',
        el('div', 'nomi-name', 'Nomi Detected: ' + nomiName)
      ),
      importBtn,
      exportBtn
    );

    importBtn.addEventListener('click', () => handleImport(tab.id));
    exportBtn.addEventListener('click', () => exportFromTab(tab.id));

  } else if (isChatPage(url)) {
    const nomiId = getNomiIdFromUrl(url);
    const sharedNotesUrl = `https://beta.nomi.ai/nomis/${nomiId}/shared-notes`;
    const navBtn = makeButton('btn-navigate', 'btn-nav', 'Navigate to Shared Notes');

    render(
      statusBox('navigate', 'Navigate to Shared Notes',
        'You\'re on the chat page. Click below to go to Shared Notes.'
      ),
      navBtn
    );

    navBtn.addEventListener('click', () => navigateToSharedNotes(tab.id, sharedNotesUrl));

  } else {
    const box = statusBox('warning', 'Wrong Page',
      'Please navigate to a Nomi\'s private chat page or Shared Notes page, then try again.'
    );
    box.appendChild(document.createElement('br'));
    box.appendChild(document.createElement('br'));
    box.appendChild(el('strong', null, 'Chat page:'));
    box.appendChild(document.createTextNode(' nomi.ai/nomis/[id]'));
    box.appendChild(document.createElement('br'));
    box.appendChild(el('strong', null, 'Notes page:'));
    box.appendChild(document.createTextNode(' nomi.ai/nomis/[id]/shared-notes'));
    render(box);
  }
}

// Export directly — already on the shared notes page
async function exportFromTab(tabId) {
  render(statusBox('working', 'Exporting\u2026', 'Reading Shared Notes, please wait.'));
  startResultTimeout(20000);
  try {
    // Clear any stale result and pass selected formats to content script
    const formats = JSON.stringify(settings.exportFormats);
    await browser.tabs.executeScript(tabId, {
      code: `window.__nomiExportResult = null; window.__nomiExportFormats = ${formats};`
    });
    await browser.tabs.executeScript(tabId, { file: 'content.js' });
    const result = await pollForExportResult(tabId, 15000);
    clearResultTimeout();
    if (result) {
      showResult(result);
    } else {
      showResult({ success: false, error: 'No response from content script.' });
    }
  } catch (err) {
    clearResultTimeout();
    showResult({ success: false, error: err.message || 'Export failed.' });
  }
}

// Navigate to shared notes page (no auto-export)
async function navigateToSharedNotes(tabId, url) {
  render(statusBox('working', 'Navigating\u2026', 'Loading Shared Notes page, please wait.'));
  startResultTimeout(35000);
  try {
    await browser.tabs.update(tabId, { url });
    await waitForTabLoad(tabId, 15000);
    await waitForTextareas(tabId, 10000);
    clearResultTimeout();
    // Navigation complete — re-init to show Ready state with Export/Import
    init();
  } catch (err) {
    clearResultTimeout();
    showResult({ success: false, error: err.message || 'Could not load the Shared Notes page.' });
  }
}

// Display the export result in the popup
function showResult(msg) {
  if (msg.success) {
    const fileCount = msg.fileCount || 1;
    const nameDiv = document.createElement('div');
    Object.assign(nameDiv.style, { textAlign: 'center', fontSize: '13px', fontWeight: '600' });
    nameDiv.textContent = msg.nomiName || 'Export complete';

    const savedDiv = document.createElement('div');
    Object.assign(savedDiv.style, { textAlign: 'center', fontSize: '11px', color: '#86efac', marginTop: '4px' });
    savedDiv.textContent = `Saved ${fileCount} file${fileCount !== 1 ? 's' : ''} to Downloads`;

    render(
      el('div', 'status-box ready',
        el('div', 'success-check', 'Success!'),
        nameDiv,
        savedDiv
      )
    );
  } else {
    const errorText = msg.error || 'Could not read the page. Make sure you are on the Shared Notes page and it has fully loaded.';
    const retryBtn = makeButton('btn-navigate', 'btn-retry', 'Try Again');
    render(
      statusBox('warning', 'Export failed', errorText),
      retryBtn
    );
    retryBtn.addEventListener('click', init);
  }
}

// Detect import mode: popup.html opened as a tab with ?import=<tabId>
const _urlParams = new URLSearchParams(window.location.search);
const _importTabId = _urlParams.get('import');
if (_importTabId) {
  startImportMode(parseInt(_importTabId, 10));
} else {
  init();
}
