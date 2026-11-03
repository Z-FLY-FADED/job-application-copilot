const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(process.env.JOBFILL_ARTIFACTS || path.join(root, 'artifacts/current'));
fs.mkdirSync(artifacts, { recursive: true });
function artifact(name) {
  const target = path.resolve(artifacts, name);
  if (!target.startsWith(artifacts + path.sep)) throw new Error('Artifact path escapes test directory');
  return target;
}
// Use the selected executable or Playwright's full Chromium, not an installed user browser.
const browserOptions = { executablePath: process.env.JOBFILL_BROWSER || chromium.executablePath() };
module.exports = { browserOptions, artifact };
