import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.resolve(root, 'dist/extension');
// Only replace the generated extension directory, never the project or local profiles.
if (path.dirname(output) !== path.join(root, 'dist') || path.basename(output) !== 'extension') throw new Error('Invalid build target');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.cp(path.join(root, 'public/extension'), output, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
manifest.version = metadata.version;
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const optionsPath = path.join(output, 'options.html');
await fs.writeFile(optionsPath, (await fs.readFile(optionsPath, 'utf8')).replaceAll('__VERSION__', metadata.version));

const entries = {
  'engine.js': ['content/engine.js', 'iife'],
  'adapters.js': ['content/adapters/moka.js', 'iife'],
  'moseeker.js': ['content/adapters/moseeker.js', 'iife'],
  'aac.js': ['content/adapters/aac.js', 'iife'],
  'submit.js': ['content/submission.js', 'iife'],
  'popup.js': ['ui/popup.js', 'esm'],
  'options.js': ['ui/options.js', 'esm'],
  'schema.js': ['shared/schema.js', 'esm'],
  'background.js': ['background.js', 'iife']
};
await Promise.all(Object.entries(entries).map(([name, [entry, format]]) => build({
  entryPoints: [path.join(root, 'src/extension', entry)],
  outfile: path.join(output, name),
  bundle: true, format, platform: 'browser', target: ['chrome102'],
  charset: 'utf8', minify: false, legalComments: 'none', logLevel: 'silent',
  define: { __JOBFILL_VERSION__: JSON.stringify(metadata.version) }
})));
console.log(`Built extension ${metadata.version}: dist/extension`);
