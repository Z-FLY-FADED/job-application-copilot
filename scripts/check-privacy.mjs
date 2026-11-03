import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const problems = [];
const forbidden = /^(local-private|node_modules|dist|artifacts|releases|work|outputs)\//;
const textExtensions = /\.(?:js|cjs|mjs|json|html|css|md|txt|ya?ml|gitignore|bat)$/i;
const privateValues = new Set();
// An optional extra check on the owner's machine; no private values are put into source or logs.
const profileDirectory = path.join(root, 'local-private/profiles');
try {
  for (const name of await fs.readdir(profileDirectory)) {
    if (!name.endsWith('.json')) continue;
    const input = JSON.parse(await fs.readFile(path.join(profileDirectory, name), 'utf8'));
    const basic = input.sections?.basic || input.profile?.basic || input.basic || {};
    for (const key of ['name','englishName','phone','email','idNumber','address','hukou','website','github']) {
      const value = basic[key];
      if (typeof value === 'string' && value.length >= 3) privateValues.add(value);
    }
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const name of candidates) {
  if (forbidden.test(name) || /\.(pdf|docx|xlsx)$/i.test(name) || /(?:^|\/)\.env(?:\.|$)/.test(name)) { problems.push(`${name}: private/generated path`); continue; }
  if (!textExtensions.test(name) && !['.gitignore','.gitattributes'].includes(path.basename(name))) continue;
  let content;
  try { content = await fs.readFile(path.join(root, name), 'utf8'); } catch (error) { if(error.code === 'ENOENT') continue; throw error; }
  if (/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content)) problems.push(`${name}: possible credential`);
  if (/(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[012])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(content)) problems.push(`${name}: possible identity number`);
  if ([...privateValues].some(value => content.includes(value) || name.includes(value))) problems.push(`${name}: matches a local private profile value`);
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Privacy check passed: ${candidates.length} repository candidates; private/generated paths excluded.`);
