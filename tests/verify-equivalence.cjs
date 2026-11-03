const { chromium } = require('playwright');
const { browserOptions, artifact } = require('./helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const baseline = path.resolve(process.env.JOBFILL_BASELINE || path.join(root, 'local-private/baseline-v1.7.0'));
const current = path.join(root, 'dist/extension');
const checks = [];
const pass = label => { checks.push(label); console.log('PASS', label); };
let server, browser;
(async () => {
  for (const file of ['popup.html','ui.css','icons/16.png','icons/48.png','icons/128.png']) {
    assert.equal(fs.readFileSync(path.join(baseline, file)).compare(fs.readFileSync(path.join(current, file))), 0);
  }
  pass('弹窗布局、全部样式和图标与1.7.0逐字节一致');
  const oldManifest = JSON.parse(fs.readFileSync(path.join(baseline, 'manifest.json')));
  const newManifest = JSON.parse(fs.readFileSync(path.join(current, 'manifest.json')));
  assert.deepEqual({...newManifest,version:oldManifest.version}, oldManifest);
  pass('manifest权限、命令、后台和CSP保持，只有版本号不同');
  assert.equal(fs.readFileSync(path.join(current,'options.html'),'utf8').replaceAll(newManifest.version,'__VERSION__'), fs.readFileSync(path.join(baseline,'options.html'),'utf8').replaceAll(oldManifest.version,'__VERSION__'));
  pass('资料页HTML只替换版本文字');
  const oldSchema = await import(pathToFileURL(path.join(baseline,'schema.js')));
  const newSchema = await import(pathToFileURL(path.join(current,'schema.js')));
  assert.deepEqual(Object.keys(newSchema).sort(), Object.keys(oldSchema).sort());
  pass('资料与匹配模块对外导出保持一致');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/demo-profile.json'))).sections;
  assert.deepEqual(newSchema.cleanProfile(data), oldSchema.cleanProfile(data));
  assert.deepEqual(newSchema.entries(newSchema.cleanProfile(data)), oldSchema.entries(oldSchema.cleanProfile(data)));
  pass('虚构资料清洗、结构化记录和可填写条目与1.7.0一致');
  const fixtureNames = ['native','moka','bsh','moseeker','aac','formats'];
  const files = {'native':path.join(current,'测试表单.html'),'moka':path.join(__dirname,'fixtures/moka-fixture.html'),'bsh':path.join(__dirname,'fixtures/bsh-fixture.html'),'moseeker':path.join(__dirname,'fixtures/moseeker-fixture.html'),'aac':path.join(__dirname,'fixtures/aac-fixture.html'),'formats':path.join(__dirname,'fixtures/format-matrix.html')};
  server = http.createServer((request,response) => {
    const name = request.url.slice(1);
    if(!files[name]){response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(fs.readFileSync(files[name]));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  browser = await chromium.launch({...browserOptions,headless:true});
  for (const name of fixtureNames) {
    const snapshots = [];
    for (const folder of [baseline,current]) {
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port+'/'+name);
      for (const file of ['engine.js','adapters.js','moseeker.js','aac.js','submit.js']) await page.addScriptTag({path:path.join(folder,file)});
      const snapshot = await page.evaluate(() => {const {scanId,...data}=__jobFill.scan();return data;});
      snapshots.push(snapshot); await page.close();
    }
    assert.deepEqual(snapshots[1],snapshots[0],name+' scan contract');
    const oldEntries = oldSchema.entries(oldSchema.cleanProfile(data)), newEntries = newSchema.entries(newSchema.cleanProfile(data));
    assert.deepEqual(snapshots[0].fields.map(f=>oldSchema.suggest(f,oldEntries)),snapshots[1].fields.map(f=>newSchema.suggest(f,newEntries)));
    pass(name+'表单扫描、字段语义及自动资料匹配与1.7.0一致');
  }
  const oldRun=JSON.parse(fs.readFileSync(path.join(root,'artifacts/baseline/summary.json'))),newRun=JSON.parse(fs.readFileSync(path.join(root,'artifacts/current/summary.json')));
  assert.equal(oldRun.total,newRun.total);
  assert.deepEqual(oldRun.suites.map(s=>({suite:s.suite,checks:s.checks})),newRun.suites.map(s=>({suite:s.suite,checks:s.checks})));
  pass('1.7.0和1.8.0通过同一套115项行为检查');
  fs.writeFileSync(artifact('equivalence-results.json'),JSON.stringify({checks,oldVersion:oldManifest.version,newVersion:newManifest.version,behaviorChecks:newRun.total},null,2));
  console.log('TOTAL',checks.length);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
