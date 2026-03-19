// popup.js — runs inside the toolbar popup

const content = document.getElementById('content');

function render(html) {
  content.innerHTML = html;
}

function getNomiIdFromUrl(url) {
  // Matches /nomis/1234567890 with optional /shared-notes suffix
  const match = url.match(/\/nomis\/(\d+)/);
  return match ? match[1] : null;
}

function isSharedNotesPage(url) {
  return /\/nomis\/\d+\/shared-notes/.test(url);
}

function isChatPage(url) {
  return /\/nomis\/\d+$/.test(url) || /\/nomis\/\d+\/?$/.test(url);
}

function isNomiAi(url) {
  return /https?:\/\/(beta\.)?nomi\.ai/.test(url);
}

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';

  if (!isNomiAi(url)) {
    // State 3: Wrong site entirely
    render(`
      <div class="status-box warning">
        <div class="label">Nomi Not Found</div>
        Navigate to a Nomi's private chat or Shared Notes page on beta.nomi.ai, then try again.
      </div>
    `);
    return;
  }

  if (isSharedNotesPage(url)) {
    // State 2: Already on shared notes — ready to extract
    const nomiId = getNomiIdFromUrl(url);
    render(`
      <div class="status-box ready">
        <div class="label">Ready</div>
        <div class="nomi-name">Shared Notes page detected</div>
        Nomi ID (URL): ${nomiId}
      </div>
      <button class="btn-export" id="btn-export">Export .txt</button>
    `);
    document.getElementById('btn-export').addEventListener('click', async () => {
      render(`
        <div class="status-box working">
          <div class="label"><span class="spinner"></span> Extracting…</div>
          Reading Shared Notes, please wait.
        </div>
      `);
      await browser.tabs.executeScript(tab.id, { file: 'content.js' });
      // Give the script a moment to start, then close — the download is the confirmation
      setTimeout(() => window.close(), 1800);
    });

  } else if (isChatPage(url)) {
    // State 1: On chat page — offer to navigate then extract
    const nomiId = getNomiIdFromUrl(url);
    const sharedNotesUrl = `https://beta.nomi.ai/nomis/${nomiId}/shared-notes`;
    render(`
      <div class="status-box navigate">
        <div class="label">Navigate to Shared Notes</div>
        You're on the chat page. Click below to go to Shared Notes and export automatically.
      </div>
      <button class="btn-navigate" id="btn-nav">Navigate to Shared Notes & Export</button>
    `);
    document.getElementById('btn-nav').addEventListener('click', async () => {
      render(`
        <div class="status-box working">
          <div class="label"><span class="spinner"></span>Navigating…</div>
          Loading Shared Notes page, please wait.
        </div>
      `);
      // Tell background to navigate the tab and then trigger extraction
      await browser.runtime.sendMessage({
        action: 'navigateAndExtract',
        tabId: tab.id,
        url: sharedNotesUrl
      });
      // Close popup — background will handle the rest
      window.close();
    });

  } else {
    // State 3: On nomi.ai but not a relevant page
    render(`
      <div class="status-box warning">
        <div class="label">Wrong Page</div>
        Please navigate to a Nomi's private chat page or Shared Notes page, then click the export button.
        <br><br>
        <strong>Chat page:</strong> nomi.ai/nomis/[id]<br>
        <strong>Notes page:</strong> nomi.ai/nomis/[id]/shared-notes
      </div>
    `);
  }
}

// Listen for result messages from content script (via background)
browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'extractResult') {
    if (msg.success) {
      render(`
        <div class="status-box ready">
          <div class="success-check">Success!</div>
          <div style="text-align:center; font-size:13px; font-weight:600;">${msg.nomiName}</div>
          <div style="text-align:center; font-size:11px; color:#86efac; margin-top:4px;">Saved to Downloads</div>
        </div>
      `);
    } else {
      render(`
        <div class="status-box warning">
          <div class="label">Export Failed</div>
          ${msg.error || 'Could not read the page. Make sure you are on the Shared Notes page and it has fully loaded.'}
        </div>
        <button class="btn-navigate" id="btn-retry">Try Again</button>
      `);
      document.getElementById('btn-retry')?.addEventListener('click', init);
    }
  }
});

init();
