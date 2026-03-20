// popup.js — toolbar popup UI, built with safe DOM methods (no innerHTML)

const content = document.getElementById('content');
let resultTimeout = null;

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

// -- Main --

async function init() {
  clearResultTimeout();
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
    const nomiId = getNomiIdFromUrl(url);
    const exportBtn = makeButton('btn-export', 'btn-export', 'Export .txt');

    render(
      statusBox('ready', 'Ready',
        el('div', 'nomi-name', 'Shared Notes page detected'),
        'Nomi ID (URL): ' + nomiId
      ),
      exportBtn
    );

    exportBtn.addEventListener('click', async () => {
      render(statusBox('working', 'Extracting\u2026', 'Reading Shared Notes, please wait.'));
      startResultTimeout(15000);
      await browser.tabs.executeScript(tab.id, { file: 'content.js' });
    });

  } else if (isChatPage(url)) {
    const nomiId = getNomiIdFromUrl(url);
    const sharedNotesUrl = `https://beta.nomi.ai/nomis/${nomiId}/shared-notes`;
    const navBtn = makeButton('btn-navigate', 'btn-nav', 'Navigate to Shared Notes & Export');

    render(
      statusBox('navigate', 'Navigate to Shared Notes',
        'You\'re on the chat page. Click below to go to Shared Notes and export automatically.'
      ),
      navBtn
    );

    navBtn.addEventListener('click', async () => {
      render(statusBox('working', 'Navigating\u2026', 'Loading Shared Notes page, please wait.'));
      startResultTimeout(20000);
      await browser.runtime.sendMessage({
        action: 'navigateAndExtract',
        tabId: tab.id,
        url: sharedNotesUrl
      });
    });

  } else {
    const box = statusBox('warning', 'Wrong Page',
      'Please navigate to a Nomi\'s private chat page or Shared Notes page, then click the export button.'
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

// Listen for extraction results from content script
browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'extractResult') {
    clearResultTimeout();

    if (msg.success) {
      const nameDiv = document.createElement('div');
      Object.assign(nameDiv.style, { textAlign: 'center', fontSize: '13px', fontWeight: '600' });
      nameDiv.textContent = msg.nomiName;

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
        statusBox('warning', 'Export Failed', errorText),
        retryBtn
      );
      retryBtn.addEventListener('click', init);
    }
  }
});

init();
