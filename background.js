// background.js — coordinates navigation and extraction across tabs

// When popup asks us to navigate then extract
browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.action === 'navigateAndExtract') {
    const { tabId, url } = msg;

    // Navigate the tab to the shared notes page
    await browser.tabs.update(tabId, { url });

    // Wait for the page to finish loading
    await waitForTabLoad(tabId);

    // Give React a moment to render
    await sleep(1500);

    // Inject the extractor
    triggerExtraction(tabId);
  }
});

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    browser.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function triggerExtraction(tabId) {
  browser.tabs.executeScript(tabId, { file: 'content.js' });
}
