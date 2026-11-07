import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(docs, '.vitepress', 'dist');
const base = process.env.DOCS_BASE || '/bb-plugin-zcode/';
assert.ok(base.startsWith('/') && base.endsWith('/'), 'DOCS_BASE must have leading and trailing slashes');
const list = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? list(path.join(dir, item.name)) : [path.join(dir, item.name)]);
const languageFiles = lang => list(path.join(docs, lang)).filter(f => f.endsWith('.md')).map(f => path.relative(path.join(docs, lang), f)).sort();
assert.deepEqual(languageFiles('en'), languageFiles('ru'), 'English and Russian page trees must match');
const files = list(output);
assert.ok(!files.some(f => /(?:^|[\\/])(verification|skill)(?:[\\/])/.test(path.relative(output, f))), 'Private/local material reached the site');
assert.ok(!fs.existsSync(path.join(output, 'native-control.html')) && !fs.existsSync(path.join(output, 'usage.html')), 'Old source-only pages reached the site');
for (const name of ['model-picker.png', 'plan-quotas.png', 'plugin-installed.png', 'provider-settings.png']) {
  const data = fs.readFileSync(path.join(output, 'screenshots', name));
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Missing PNG screenshot: ${name}`);
}
let links = 0;
for (const file of files.filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  const url = new URL(base + path.relative(output, file).split(path.sep).join('/'), 'https://docs.invalid');
  for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:data:|mailto:|tel:|javascript:)/.test(raw)) continue;
    const link = new URL(raw.replaceAll('&amp;', '&'), url);
    if (link.origin !== url.origin) continue;
    assert.ok(link.pathname.startsWith(base), `Link escapes the Pages base: ${raw} in ${file}`);
    const relative = decodeURIComponent(link.pathname.slice(base.length));
    const target = path.join(output, relative || 'index.html');
    const candidates = [target, path.join(target, 'index.html'), target + '.html'];
    assert.ok(candidates.some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()), `Broken static link: ${raw} in ${file}`);
    links++;
  }
}
console.log(`Documentation checked: ${languageFiles('en').length} pages per language, 4 screenshots, ${links} local links/assets.`);
