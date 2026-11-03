const { chromium } = require('playwright');
const { browserOptions, artifact } = require('./helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let browser, server;
const checks = [];
(async () => {
  const publicFiles = new Set(['index.html','styles.css','app.js','platform-adapters.js','job-sources.js','daily-jobs.js']);
  server = http.createServer((request, response) => {
    const name = (request.url || '/').split('?')[0].replace(/^\//, '') || 'index.html';
    if (!publicFiles.has(name)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    response.end(fs.readFileSync(path.join(root, name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ ...browserOptions, headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.locator('#candidateName').waitFor({state:'attached'});
  assert.equal(await page.locator('#candidateName').inputValue(), '');
  assert.equal(await page.locator('#resumeText').inputValue(), '');
  checks.push('原网页助手可加载，默认姓名和简历为空');
  await page.locator('[data-view=resume]').click();
  await page.locator('#candidateName').fill('虚构网页候选人');
  await page.locator('#saveProfile').click();
  await page.reload();
  assert.equal(await page.locator('#candidateName').inputValue(), '虚构网页候选人');
  checks.push('原网页助手资料保存和重载仍工作，使用独立虚构浏览器资料');
  assert.deepEqual(errors, []);
  checks.push('原网页助手运行无未捕获脚本错误');
  fs.writeFileSync(artifact('web-test-results.json'), JSON.stringify({checks,browser:browser.version()}, null, 2));
  console.log('TOTAL', checks.length);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.close(); });
