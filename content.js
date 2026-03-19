// content.js — runs on the shared-notes page, reads fields, triggers download

(async function () {
  // Prevent double-execution if injected multiple times
  if (window.__nomiExporterRunning) return;
  window.__nomiExporterRunning = true;

  const FIELD_DEFINITIONS = [
    {
      key: 'backstory',
      label: 'BACKSTORY',
      // Field placeholders and labels we can use to identify textareas in order
    },
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

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Scroll the page top-to-bottom to force React to render all virtualized fields
  async function scrollToRevealAll() {
    const scrollStep = 400;
    const delay = 80;
    const total = document.body.scrollHeight;
    let pos = 0;
    while (pos < total) {
      window.scrollTo(0, pos);
      await sleep(delay);
      pos += scrollStep;
    }
    window.scrollTo(0, 0);
    await sleep(300);
  }

  // Extract Nomi name from page title — format is "Shared Notes | Dalia | Nomi.ai"
  function getNomiName() {
    const parts = document.title.split('|').map(s => s.trim());
    // Find the part that isn't "Shared Notes" and isn't "Nomi.ai"
    for (const part of parts) {
      if (part && !/shared notes/i.test(part) && !/nomi\.ai/i.test(part)) {
        return part;
      }
    }
    // Fall back to URL ID if title parsing fails
    const urlMatch = window.location.pathname.match(/\/nomis\/(\d+)/);
    return urlMatch ? `Nomi_${urlMatch[1]}` : 'Nomi';
  }

  // Get Nomi ID from URL
  function getNomiId() {
    const m = window.location.pathname.match(/\/nomis\/(\d+)/);
    return m ? m[1] : 'unknown';
  }

  // Read all textareas in DOM order — Nomi renders them top-to-bottom matching field order
  function readTextareas() {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    return textareas.map(ta => ta.value ? ta.value.trim() : '');
  }

  // Build the output .txt content
  function buildOutput(nomiName, nomiId, fieldValues) {
    const divider = '═'.repeat(50);
    const now = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const lines = [
      divider,
      `${nomiName.toUpperCase()} — SHARED NOTES`,
      `Exported: ${now}`,
      `Nomi ID (From URL): ${nomiId}`,
      divider,
      '',
    ];

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

  // Trigger a .txt file download
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

  // --- Main ---
  try {
    // Scroll to force all React components to render
    await scrollToRevealAll();

    // Give React one more tick to settle after scroll
    await sleep(500);

    const nomiName = getNomiName();
    const nomiId = getNomiId();
    const fieldValues = readTextareas();

    if (fieldValues.length === 0) {
      browser.runtime.sendMessage({
        action: 'extractResult',
        success: false,
        error: 'No text fields found. Make sure you are on the Shared Notes page.'
      });
      window.__nomiExporterRunning = false;
      return;
    }

    const output = buildOutput(nomiName, nomiId, fieldValues);
    const filename = `${nomiName.replace(/[^a-z0-9]/gi, '_')}_Shared_Notes.txt`;

    download(filename, output);

    browser.runtime.sendMessage({
      action: 'extractResult',
      success: true,
      nomiName: nomiName
    });

  } catch (err) {
    browser.runtime.sendMessage({
      action: 'extractResult',
      success: false,
      error: err.message || 'Unknown error during extraction.'
    });
  }

  window.__nomiExporterRunning = false;
})();
