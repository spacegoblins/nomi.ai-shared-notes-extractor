// popup.js — toolbar popup for v1.5
// Shows the same Settings / About tab interface as the in-page ⚙ modal.

const tabBar = document.getElementById('tab-bar');
const tabContent = document.getElementById('tab-content');

// ── Default Settings ──

const DEFAULT_SETTINGS = {
  exportFormats: { txt: true, md: false, csv: false },
};

// ── Storage ──

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

// ── Tab state ──

let settingsTabEl, aboutTabEl;

function buildTabBar() {
  settingsTabEl = document.createElement('button');
  settingsTabEl.className = 'modal-tab active';
  settingsTabEl.textContent = 'Settings';
  settingsTabEl.addEventListener('click', () => {
    settingsTabEl.classList.add('active');
    aboutTabEl.classList.remove('active');
    renderSettingsContent();
  });

  aboutTabEl = document.createElement('button');
  aboutTabEl.className = 'modal-tab';
  aboutTabEl.textContent = 'About';
  aboutTabEl.addEventListener('click', () => {
    aboutTabEl.classList.add('active');
    settingsTabEl.classList.remove('active');
    renderAboutContent();
  });

  tabBar.appendChild(settingsTabEl);
  tabBar.appendChild(aboutTabEl);
}

// ── Settings tab ──

async function renderSettingsContent() {
  tabContent.textContent = '';
  const settings = await loadSettings();

  const desc = document.createElement('div');
  desc.className = 'settings-desc';
  desc.textContent = 'Select which formats to include when exporting:';
  tabContent.appendChild(desc);

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
      const anyChecked = Object.values(settings.exportFormats).some(v => v);
      if (!anyChecked) {
        settings.exportFormats[fmt.key] = true;
        cb.checked = true;
      }
      await saveSettings(settings);
    });

    row.appendChild(cb);
    row.appendChild(document.createTextNode(fmt.label));
    form.appendChild(row);
  }
  tabContent.appendChild(form);
}

// ── About tab ──

const REPO_URL = 'https://github.com/spacegoblins/nomi.ai-shared-notes-extractor';
const RELEASES_API_URL = 'https://api.github.com/repos/spacegoblins/nomi.ai-shared-notes-extractor/releases/latest';

function renderAboutContent() {
  tabContent.textContent = '';

  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'info-text';
  loadingMsg.textContent = 'Fetching release info\u2026';
  tabContent.appendChild(loadingMsg);

  fetch(RELEASES_API_URL, { headers: { 'Accept': 'application/vnd.github.v3+json' } })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(release => {
      tabContent.textContent = '';

      const versionDiv = document.createElement('div');
      versionDiv.className = 'about-version';
      versionDiv.textContent = `Version: ${release.tag_name || release.name || 'unknown'}`;
      tabContent.appendChild(versionDiv);

      if (release.published_at) {
        const date = new Date(release.published_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        const dateDiv = document.createElement('div');
        dateDiv.className = 'about-date';
        dateDiv.textContent = `Released: ${date}`;
        tabContent.appendChild(dateDiv);
      }

      if (release.body) {
        const notesLabel = document.createElement('div');
        notesLabel.className = 'about-notes-label';
        notesLabel.textContent = 'Release Notes:';
        tabContent.appendChild(notesLabel);

        const notesBody = document.createElement('div');
        notesBody.className = 'about-notes-body';
        notesBody.textContent = release.body;
        tabContent.appendChild(notesBody);
      }

      appendRepoLink();
    })
    .catch(() => {
      tabContent.textContent = '';

      const manifest = browser.runtime.getManifest();
      const versionDiv = document.createElement('div');
      versionDiv.className = 'about-version';
      versionDiv.textContent = `Version: ${manifest.version}`;
      tabContent.appendChild(versionDiv);

      const failMsg = document.createElement('div');
      failMsg.className = 'info-text';
      failMsg.textContent = 'Could not fetch release info.';
      tabContent.appendChild(failMsg);

      appendRepoLink();
    });
}

function appendRepoLink() {
  const linkDiv = document.createElement('div');
  linkDiv.style.marginTop = '8px';
  const link = document.createElement('a');
  link.href = REPO_URL;
  link.textContent = 'View on GitHub';
  link.className = 'settings-link';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  linkDiv.appendChild(link);
  tabContent.appendChild(linkDiv);
}

// ── Init ──

buildTabBar();
renderSettingsContent();
