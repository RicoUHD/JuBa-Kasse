const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { selectChurchLogoFilePath } = require('./logoStorage');

test('selectChurchLogoFilePath prefers uploaded logo when present', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-logo-test-'));
  const uploadedLogoPath = path.join(tempDir, 'uploaded-church-logo.svg');
  const bundledLogoPath = path.join(tempDir, 'bundled-church-logo.svg');

  fs.writeFileSync(uploadedLogoPath, '<svg></svg>', 'utf8');
  fs.writeFileSync(bundledLogoPath, '<svg></svg>', 'utf8');

  assert.equal(
    selectChurchLogoFilePath(uploadedLogoPath, bundledLogoPath),
    uploadedLogoPath
  );
});

test('selectChurchLogoFilePath falls back to bundled logo when upload is absent', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-logo-test-'));
  const uploadedLogoPath = path.join(tempDir, 'uploaded-church-logo.svg');
  const bundledLogoPath = path.join(tempDir, 'bundled-church-logo.svg');

  fs.writeFileSync(bundledLogoPath, '<svg></svg>', 'utf8');

  assert.equal(
    selectChurchLogoFilePath(uploadedLogoPath, bundledLogoPath),
    bundledLogoPath
  );
});
