// content.js — exports shared notes fields and triggers download (runs in page context)
// v1.3 — multi-format export (.txt, .md, .csv), refactored structure

(async function () {
  if (window.__nomiExporterRunning) return;
  window.__nomiExporterRunning = true;

  // ============================================================
  // Shared Utilities
  // ============================================================

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

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

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

  function getReadableDate() {
    return new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Gather all structured data needed by formatters
  function collectExportData() {
    const nomiName = getNomiName();
    const nomiId = getNomiId();
    const fieldValues = readTextareas();
    const timestamp = getTimestamp();
    const readableDate = getReadableDate();
    return { nomiName, nomiId, fieldValues, timestamp, readableDate };
  }

  // ============================================================
  // Format Builders
  // ============================================================

  function buildTxt(data) {
    const divider = '\u2550'.repeat(50);
    const lines = [
      divider,
      `${data.nomiName.toUpperCase()} \u2014 SHARED NOTES`,
      `Exported: ${data.readableDate}`,
      `Nomi ID (From URL): ${data.nomiId}`,
      divider,
      '',
    ];

    if (data.fieldValues.length !== FIELD_DEFINITIONS.length) {
      lines.push(`\u26A0 WARNING: Expected ${FIELD_DEFINITIONS.length} fields, found ${data.fieldValues.length} \u2014 some labels may be misaligned.`);
      lines.push('');
    }

    FIELD_DEFINITIONS.forEach((field, i) => {
      const value = data.fieldValues[i] || '';
      lines.push(`${field.label}:`);
      lines.push(value !== '' ? `\`${value}\`` : '(empty)');
      lines.push('');
    });

    lines.push(divider);
    lines.push('');
    return lines.join('\n');
  }

  function buildMd(data) {
    const lines = [
      `# ${data.nomiName} \u2014 Shared Notes`,
      '',
      `**Exported:** ${data.readableDate}  `,
      `**Nomi ID:** ${data.nomiId}`,
      '',
      '---',
      '',
    ];

    if (data.fieldValues.length !== FIELD_DEFINITIONS.length) {
      lines.push(`> \u26A0 **WARNING:** Expected ${FIELD_DEFINITIONS.length} fields, found ${data.fieldValues.length} \u2014 some labels may be misaligned.`);
      lines.push('');
    }

    FIELD_DEFINITIONS.forEach((field, i) => {
      const value = data.fieldValues[i] || '';
      lines.push(`## ${field.label}`);
      lines.push('');
      lines.push(value !== '' ? value : '*(empty)*');
      lines.push('');
    });

    return lines.join('\n');
  }

  function csvEscape(value) {
    if (value === '') return '""';
    // Wrap in quotes if the value contains commas, quotes, or newlines
    if (/[",\n\r]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  function buildCsv(data) {
    const headers = [
      'nomi_name',
      'nomi_id',
      'export_timestamp',
      ...FIELD_DEFINITIONS.map(f => f.key.replace(/([A-Z])/g, '_$1').toLowerCase())
    ];

    const values = [
      csvEscape(data.nomiName),
      csvEscape(data.nomiId),
      csvEscape(data.readableDate),
      ...FIELD_DEFINITIONS.map((_, i) => csvEscape(data.fieldValues[i] || ''))
    ];

    return headers.join(',') + '\n' + values.join(',') + '\n';
  }

  // ============================================================
  // Download
  // ============================================================

  function download(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
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
    window.__nomiExportResult = msg;
    browser.runtime.sendMessage(msg).catch(() => {});
  }

  // ============================================================
  // Main Export
  // ============================================================

  try {
    await scrollToRevealAll();
    await sleep(500);

    const data = collectExportData();

    if (data.fieldValues.length === 0) {
      sendMessage({
        action: 'exportResult',
        success: false,
        error: 'No text fields found. Make sure you are on the Shared Notes page.'
      });
      window.__nomiExporterRunning = false;
      return;
    }

    // Read selected formats from window (set by popup before injection)
    const formats = window.__nomiExportFormats || { txt: true };
    const fileBase = `${data.nomiName.replace(/[^a-z0-9]/gi, '_')}_Shared_Notes.${data.timestamp}`;
    const downloaded = [];

    if (formats.txt) {
      const filename = `${fileBase}.txt`;
      download(filename, buildTxt(data), 'text/plain; charset=utf-8');
      downloaded.push(filename);
    }

    if (formats.md) {
      const filename = `${fileBase}.md`;
      download(filename, buildMd(data), 'text/markdown; charset=utf-8');
      downloaded.push(filename);
    }

    if (formats.csv) {
      const filename = `${fileBase}.csv`;
      download(filename, buildCsv(data), 'text/csv; charset=utf-8');
      downloaded.push(filename);
    }

    sendMessage({
      action: 'exportResult',
      success: true,
      nomiName: data.nomiName,
      fileCount: downloaded.length,
      filenames: downloaded
    });

  } catch (err) {
    sendMessage({
      action: 'exportResult',
      success: false,
      error: err.message || 'Unknown error during export.'
    });
  }

  window.__nomiExporterRunning = false;
})();
