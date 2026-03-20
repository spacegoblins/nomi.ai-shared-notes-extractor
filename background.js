// background.js — coordinates navigation and extraction across tabs

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.action === 'navigateAndExtract') {
    try {
      const { tabId, url } = msg;

      await browser.tabs.update(tabId, { url });
      await waitForTabLoad(tabId, 15000);
      await waitForReactRender(tabId, 10000);
      await browser.tabs.executeScript(tabId, { file: 'content.js' });
    } catch (err) {
      // Notify popup if it's still open — silently ignore if it closed
      browser.runtime.sendMessage({
        action: 'extractResult',
        success: false,
        error: err.message || 'Navigation or extraction failed.'
      }).catch(() => {});
    }
  }
});

function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timed out.'));
    }, timeoutMs);

    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') done();
    }

    browser.tabs.onUpdated.addListener(listener);

    // Guard against race: tab may have finished loading before listener attached
    browser.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') done();
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Poll until at least one textarea appears, signaling React has rendered
async function waitForReactRender(tabId, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const results = await browser.tabs.executeScript(tabId, {
      code: 'document.querySelectorAll("textarea").length'
    });
    if (results[0] > 0) return;
    await sleep(500);
  }
  // Don't throw — content.js will report the error if no textareas are found
}
