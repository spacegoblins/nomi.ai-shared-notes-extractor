// content.js — LEGACY v1.2 popup-injected export script
// TODO: This file is dead code as of v1.4. All export/import logic now lives in inject.js,
// TODO: which is auto-injected via manifest content_scripts. This file is no longer referenced
// TODO: by any part of the extension and can be safely deleted once v1.4 is confirmed stable.

(async function () {
  if (window.__nomiExporterRunning) return;
  window.__nomiExporterRunning = true;

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

  // Content scripts run in page context, so this sleep is separate from background.js
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Scroll top-to-bottom to force React to render all virtualized fields
  async function scrollToRevealAll() {
    const scrollStep = 400;
    const delay = 80;
    let pos = 0;
    // Re-check scrollHeight each iteration — page may grow as content renders
    while (pos < document.body.scrollHeight) {
      window.scrollTo(0, pos);
      await sleep(delay);
      pos += scrollStep;
    }
    window.scrollTo(0, 0);
    await sleep(300);
  }

  function getNomiName() {
    const parts = document.title.split('|').map(s => s.trim());
    for (const part of parts) {
      if (part && !/shared notes/i.test(part) && !/nomi\.ai/i.test(part)) {
        return part;
      }
    }
    const urlMatch = window.location.pathname.match(/\/nomis\/(\d+)/);
    return urlMatch ? `Nomi_${urlMatch[1]}` : 'Nomi';
  }

  function getNomiId() {
    const m = window.location.pathname.match(/\/nomis\/(\d+)/);
    return m ? m[1] : 'unknown';
  }

  function readTextareas() {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    return textareas.map(ta => ta.value ? ta.value.trim() : '');
  }

  function getTimestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }

  function buildOutput(nomiName, nomiId, fieldValues) {
    const divider = '\u2550'.repeat(50);
    const now = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const lines = [
      divider,
      `${nomiName.toUpperCase()} \u2014 SHARED NOTES`,
      `Exported: ${now}`,
      `Nomi ID (From URL): ${nomiId}`,
      divider,
      '',
    ];

    if (fieldValues.length !== FIELD_DEFINITIONS.length) {
      lines.push(`\u26A0 WARNING: Expected ${FIELD_DEFINITIONS.length} fields, found ${fieldValues.length} \u2014 some labels may be misaligned.`);
      lines.push('');
    }

    FIELD_DEFINITIONS.forEach((field, i) => {
      const value = fieldValues[i] || '';
      lines.push(`${field.label}:`);
      lines.push(value !== '' ? `\`${value}\`` : '(empty)');
      lines.push('');
    });

    lines.push(divider);
    lines.push('');

    return lines.join('\n');
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sendMessage(msg) {
    // Set result on window so popup can poll for it via executeScript
    window.__nomiExportResult = msg;
    // Also try runtime.sendMessage as a belt-and-suspenders fallback
    browser.runtime.sendMessage(msg).catch(() => {});
  }

  // --- Main ---
  try {
    await scrollToRevealAll();
    await sleep(500);

    const nomiName = getNomiName();
    const nomiId = getNomiId();
    const fieldValues = readTextareas();

    if (fieldValues.length === 0) {
      sendMessage({
        action: 'extractResult',
        success: false,
        error: 'No text fields found. Make sure you are on the Shared Notes page.'
      });
      window.__nomiExporterRunning = false;
      return;
    }

    const output = buildOutput(nomiName, nomiId, fieldValues);
    const timestamp = getTimestamp();
    const filename = `${nomiName.replace(/[^a-z0-9]/gi, '_')}_Shared_Notes.${timestamp}.txt`;

    download(filename, output);

    sendMessage({
      action: 'extractResult',
      success: true,
      nomiName: nomiName,
      filename: filename
    });

  } catch (err) {
    sendMessage({
      action: 'extractResult',
      success: false,
      error: err.message || 'Unknown error during extraction.'
    });
  }

  window.__nomiExporterRunning = false;
})();
