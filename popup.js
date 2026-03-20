// popup.js — toolbar popup UI, built with safe DOM methods (no innerHTML)
// v1.3 — multi-format export, import, settings, about panel

const content = document.getElementById('content');
const buttonBar = document.getElementById('button-bar');
let resultTimeout = null;
let currentView = 'main'; // 'main' | 'settings' | 'about'

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
    homeBtn.textContent = '\uD83C\uDFE0 Home';
    homeBtn.addEventListener('click', () => {
      currentView = 'main';
      renderButtonBar('main');
      init();
    });
    buttonBar.appendChild(homeBtn);
  } else {
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn-capsule';
    settingsBtn.textContent = '\u2699 Settings';
    settingsBtn.addEventListener('click', () => {
      currentView = 'settings';
      renderButtonBar('settings');
      renderSettingsPanel();
    });

    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'btn-capsule';
    aboutBtn.textContent = '\u2139 About';
    aboutBtn.addEventListener('click', () => {
      currentView = 'about';
      renderButtonBar('about');
      renderAboutPanel();
    });

    buttonBar.appendChild(settingsBtn);
    buttonBar.appendChild(aboutBtn);
  }
}

// -- Panels (placeholders — full implementations in later phases) --

function renderSettingsPanel() {
  render(
    statusBox('ready', 'Settings', 'Settings panel coming soon.')
  );
}

function renderAboutPanel() {
  render(
    statusBox('ready', 'About', 'About panel coming soon.')
  );
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

    const exportBtn = makeButton('btn-export', 'btn-export', 'Export .txt');

    render(
      statusBox('ready', 'Ready to Export',
        el('div', 'nomi-name', 'Nomi Detected: ' + nomiName)
      ),
      exportBtn
    );

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
    // Clear any stale result from a previous run
    await browser.tabs.executeScript(tabId, { code: 'window.__nomiExportResult = null;' });
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
    const nameDiv = document.createElement('div');
    Object.assign(nameDiv.style, { textAlign: 'center', fontSize: '13px', fontWeight: '600' });
    nameDiv.textContent = msg.filename || msg.nomiName;

    const savedDiv = document.createElement('div');
    Object.assign(savedDiv.style, { textAlign: 'center', fontSize: '11px', color: '#86efac', marginTop: '4px' });
    savedDiv.textContent = 'Saved to Downloads';

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

init();
