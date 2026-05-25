import { readFileSync, writeFileSync, mkdirSync, cpSync, statSync } from 'fs';
import { join } from 'path';
import { minify } from 'terser';
import postcss from 'postcss';
import cssnano from 'cssnano';
import { minify as minifyHTML } from 'html-minifier-terser';

const SRC  = './frontend';
const DIST = './dist';

function kb(bytes) { return (bytes / 1024).toFixed(1) + ' KB'; }

mkdirSync(DIST, { recursive: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });

// Copy SVG assets as-is (already tiny)
cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
console.log('✓ assets copied');

// Minify JS — keep top-level names intact (called from HTML/other scripts)
const jsFiles = [
  'config.js', 'i18n.js', 'cache.js', 'api.js',
  'tables.js', 'dashboard.js', 'kanban.js', 'chat.js', 'quotations.js'
];
for (const file of jsFiles) {
  const src = readFileSync(join(SRC, file), 'utf8');
  const result = await minify(src, {
    compress: { passes: 2, drop_console: false },
    mangle: { toplevel: false },
    format: { comments: false },
  });
  writeFileSync(join(DIST, file), result.code);
  console.log(`✓ ${file.padEnd(16)} ${kb(src.length).padStart(8)} → ${kb(result.code.length).padStart(8)}`);
}

// Minify CSS
const cssSrc = readFileSync(join(SRC, 'style.css'), 'utf8');
const cssResult = await postcss([cssnano({ preset: 'default' })]).process(cssSrc, { from: undefined });
writeFileSync(join(DIST, 'style.css'), cssResult.css);
console.log(`✓ ${'style.css'.padEnd(16)} ${kb(cssSrc.length).padStart(8)} → ${kb(cssResult.css.length).padStart(8)}`);

// Minify HTML (also minifies any inline <style>/<script> blocks)
const htmlSrc = readFileSync(join(SRC, 'index.html'), 'utf8');
const htmlResult = await minifyHTML(htmlSrc, {
  collapseWhitespace: true,
  collapseInlineTagWhitespace: false,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  minifyCSS: true,
  minifyJS: { compress: { passes: 2 }, mangle: false },
  useShortDoctype: true,
  sortAttributes: true,
});
writeFileSync(join(DIST, 'index.html'), htmlResult);
console.log(`✓ ${'index.html'.padEnd(16)} ${kb(htmlSrc.length).padStart(8)} → ${kb(htmlResult.length).padStart(8)}`);

// Summary
let totalSrc = 0, totalDist = 0;
[...jsFiles, 'style.css', 'index.html'].forEach(f => {
  totalSrc  += statSync(join(SRC, f)).size;
  totalDist += statSync(join(DIST, f)).size;
});
console.log(`\nTotal: ${kb(totalSrc)} → ${kb(totalDist)} (${Math.round((1 - totalDist / totalSrc) * 100)}% smaller)`);
