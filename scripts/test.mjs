import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv.includes('--baseline');
const extension = path.resolve(process.env.JOBFILL_EXTENSION_DIR || path.join(root, baseline ? 'local-private/baseline-v1.7.0' : 'dist/extension'));
const artifacts = path.join(root, 'artifacts', baseline ? 'baseline' : 'current');
await fs.mkdir(artifacts, { recursive: true });
await fs.access(path.join(extension, 'manifest.json'));
const suites = [
  ['native', 'verify.cjs', 'test-results.json'],
  ['moka', 'verify-moka.cjs', 'moka-test-results.json'],
  ['bsh', 'verify-bsh.cjs', 'bsh-test-results.json'],
  ['moseeker', 'verify-moseeker.cjs', 'moseeker-test-results.json'],
  ['aac', 'verify-aac.cjs', 'aac-test-results.json'],
  ['formats', 'verify-formats.cjs', 'format-test-results.json'],
  ['web', 'verify-web.cjs', 'web-test-results.json']
];
const run = ([name, file, result]) => new Promise(resolve => {
  const child = spawn(process.execPath, [path.join(root, 'tests', file)], {
    cwd: root, env: { ...process.env, JOBFILL_EXTENSION_DIR: extension, JOBFILL_ARTIFACTS: artifacts }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', c => log += c); child.stderr.on('data', c => log += c);
  const timer = setTimeout(() => { child.kill(); }, Number(process.env.JOBFILL_SUITE_TIMEOUT || 180000));
  child.on('error', error => { log += String(error); });
  child.on('close', async code => {
    clearTimeout(timer); await fs.writeFile(path.join(artifacts, `${name}.log`), log);
    console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${name}`);
    if (code !== 0) console.error(log.slice(-5000));
    resolve({ name, code, result });
  });
});
const results = await Promise.all(suites.map(run));
if (results.some(r => r.code !== 0)) process.exitCode = 1;
else {
  const summaries = await Promise.all(results.map(async r => ({ suite: r.name, ...JSON.parse(await fs.readFile(path.join(artifacts, r.result), 'utf8')) })));
  const checks = summaries.flatMap(s => s.checks);
  await fs.writeFile(path.join(artifacts, 'summary.json'), JSON.stringify({ baseline, extensionVersion: JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'))).version, suites: summaries, total: checks.length }, null, 2));
  console.log(`${checks.length}/${checks.length} checks passed (${baseline ? 'baseline' : 'refactored'})`);
}
