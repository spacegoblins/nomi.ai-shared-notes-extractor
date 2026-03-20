// popup.js — toolbar popup UI for v1.4
// Shows page detection status, Settings panel, and About panel.
// Import/Export buttons now live in inject.js (injected into the page header).

const content = document.getElementById('content');
const buttonBar = document.getElementById('button-bar');

// ── Default Settings ──

const DEFAULT_SETTINGS = {
  exportFormats: { txt: true, md: false, csv: false },
};

// ── URL Helpers ──

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

// ── DOM Helpers ──

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
  label.textContent = labelText;
  box.appendChild(label);
  for (const child of bodyChildren) {
    if (typeof child === 'string') box.appendChild(document.createTextNode(child));
    else if (child) box.appendChild(child);
  }
  return box;
}

// ── Panel State ──

let activePanel = 'home'; // 'home' | 'settings' | 'about'

function setActivePanel(panel) {
  activePanel = panel;
  renderButtonBar();
  if (panel === 'home') init();
  else if (panel === 'settings') showSettings();
  else if (panel === 'about') showAbout();
}

function renderButtonBar() {
  buttonBar.textContent = '';
  if (activePanel === 'home') {
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn-capsule';
    settingsBtn.textContent = 'Settings';
    settingsBtn.addEventListener('click', () => setActivePanel('settings'));

    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'btn-capsule';
    aboutBtn.textContent = 'About';
    aboutBtn.addEventListener('click', () => setActivePanel('about'));

    buttonBar.appendChild(settingsBtn);
    buttonBar.appendChild(aboutBtn);
  } else {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-capsule';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => setActivePanel('home'));
    buttonBar.appendChild(backBtn);
  }
}

// ── Settings Panel ──

async function loadSettings() {
  try {
    const stored = await browser.storage.sync.get('settings');
    if (stored.settings) {
      return Object.assign(structuredClone(DEFAULT_SETTINGS), stored.settings);
    }
  } catch (e) { /* storage unavailable */ }
  return structuredClone(DEFAULT_SETTINGS);
}

async function saveSettings(settings) {
  await browser.storage.sync.set({ settings });
}

async function showSettings() {
  const settings = await loadSettings();

  const heading = el('div', 'panel-heading', 'Export Settings');
  const desc = el('div', 'panel-desc', 'Select which formats to include when exporting:');

  const form = document.createElement('div');
  form.className = 'settings-form';

  const formats = [
    { key: 'txt', label: 'Plain Text (.txt)' },
    { key: 'md',  label: 'Markdown (.md)' },
    { key: 'csv', label: 'CSV (.csv)' },
  ];

  for (const fmt of formats) {
    const row = document.createElement('label');
    row.className = 'checkbox-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!settings.exportFormats[fmt.key];
    cb.addEventListener('change', async () => {
      settings.exportFormats[fmt.key] = cb.checked;
      // Ensure at least one format stays selected
      const anyChecked = Object.values(settings.exportFormats).some(v => v);
      if (!anyChecked) {
        settings.exportFormats[fmt.key] = true;
        cb.checked = true;
      }
      await saveSettings(settings);
    });

    const text = document.createTextNode(fmt.label);
    row.appendChild(cb);
    row.appendChild(text);
    form.appendChild(row);
  }

  render(heading, desc, form);
}

// ── About Panel ──

function showAbout() {
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

      const versionDiv = el('div', null, `Version: ${release.tag_name || release.name || 'unknown'}`);
      Object.assign(versionDiv.style, { fontSize: '12px', fontWeight: '600', color: '#e4e4e7', marginBottom: '4px' });
      container.appendChild(versionDiv);

      if (release.published_at) {
        const date = new Date(release.published_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        const dateDiv = el('div', null, `Released: ${date}`);
        Object.assign(dateDiv.style, { fontSize: '11px', color: '#a1a1aa', marginBottom: '10px' });
        container.appendChild(dateDiv);
      }

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

      appendRepoLink(container, REPO_URL);
    })
    .catch(() => {
      container.textContent = '';

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

// ── Main ──

async function init() {
  activePanel = 'home';
  renderButtonBar();

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';

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

    render(
      statusBox('ready', `${nomiName} Shared Notes Detected`,
        el('div', 'status-hint', 'Use the Import and Export buttons in the page header.')
      )
    );

  } else if (isChatPage(url)) {
    const nomiId = getNomiIdFromUrl(url);
    const sharedNotesUrl = `https://beta.nomi.ai/nomis/${nomiId}/shared-notes`;
    const navBtn = document.createElement('button');
    navBtn.className = 'btn-navigate';
    navBtn.textContent = 'Navigate to Shared Notes';
    navBtn.addEventListener('click', async () => {
      await browser.tabs.update(tab.id, { url: sharedNotesUrl });
      window.close();
    });

    render(
      statusBox('navigate', 'Navigate to Shared Notes',
        'You\'re on the chat page. Click below to go to Shared Notes.'
      ),
      navBtn
    );

  } else if (isNomiAi(url)) {
    render(
      statusBox('warning', 'Navigate to Shared Notes',
        'Navigate to your Nomi\'s Shared Notes to use this extension.'
      )
    );

  } else {
    render(
      statusBox('warning', 'Nomi Not Detected',
        'Navigate to your Nomi\'s Shared Notes on beta.nomi.ai to use this extension.'
      )
    );
  }
}

// ── Init ──

init();
