// web-ext configuration — controls how the extension is packaged for AMO.
// Run locally with:  npx web-ext build   or   npx web-ext sign
//
// sourceDir is the repo root (where manifest.json lives). artifactsDir is
// where web-ext writes the generated .zip/.xpi. ignoreFiles is the blacklist
// of files/folders that must NOT end up in the uploaded package.

export default {
  sourceDir: '.',
  artifactsDir: 'web-ext-artifacts',

  ignoreFiles: [
    // Repo / tooling files that shouldn't ship in the add-on
    '.gitignore',
    '.github',
    '.web-ext-config.mjs',
    'web-ext-artifacts',

    // Docs and assets not needed at runtime
    'README.md',
    'LICENSE',
    'screenshots',
  ],
};