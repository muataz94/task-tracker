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

// Required for GitHub Pages — prevents Jekyll from processing the output
writeFileSync(join(DIST, '.nojekyll'), '');

// Copy SVG assets as-is (already tiny)
cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
console.log('✓ assets copied');

// Copy service worker as-is (not minified — keep it simple/reliable)
cpSync(join(SRC, 'sw.js'), join(DIST, 'sw.js'));
cpSync(join(SRC, 'manifest.webmanifest'), join(DIST, 'manifest.webmanifest'));
console.log('✓ sw.js copied');

// Minify JS — keep top-level names intact (called from HTML/other scripts)
const jsFiles = [
  'config.js', 'i18n.js', 'cache.js', 'api.js',
  'tables.js', 'dashboard.js', 'kanban.js', 'chat.js', 'icons.js', 'quotations.js', 'invoices.js', 'vendors.js',
  'messaging.js', 'purchasereqs.js', 'ai-chat.js', 'notifications.js', 'budget.js', 'analytics.js', 'offline.js',
  'dashboard-v2.js', 'mobile-nav.js', 'mobile-v3.js', 'forms-v4.js', 'desktop-v1.js', 'mobile-v4.js'
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
const cssFiles = ['style.css', 'dashboard-v2.css', 'mobile-v2.css', 'mobile-v3.css', 'ai-v5.css', 'desktop-v1.css', 'mobile-v4.css'];
for (const file of cssFiles) {
  const cssSrc = readFileSync(join(SRC, file), 'utf8');
  const cssResult = await postcss([cssnano({ preset: 'default' })]).process(cssSrc, { from: undefined });
  writeFileSync(join(DIST, file), cssResult.css);
  console.log(`✓ ${file.padEnd(16)} ${kb(cssSrc.length).padStart(8)} → ${kb(cssResult.css.length).padStart(8)}`);
}

// Minify HTML (also minifies any inline <style>/<script> blocks)
const configuredGatewayUrl = String(process.env.TASK_TRACKER_AI_GATEWAY_URL || '').trim().replace(/\/+$/, '');
if (configuredGatewayUrl) {
  const gatewayUrl = new URL(configuredGatewayUrl);
  if (gatewayUrl.protocol !== 'https:' || gatewayUrl.username || gatewayUrl.password || gatewayUrl.search || gatewayUrl.hash) {
    throw new Error('TASK_TRACKER_AI_GATEWAY_URL must be a public HTTPS origin/path without credentials, query, or fragment');
  }
}
const htmlSrc = readFileSync(join(SRC, 'index.html'), 'utf8')
  .replace('__TASK_TRACKER_AI_GATEWAY_URL__', configuredGatewayUrl);
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
[...jsFiles, ...cssFiles, 'index.html'].forEach(f => {
  totalSrc  += statSync(join(SRC, f)).size;
  totalDist += statSync(join(DIST, f)).size;
});
console.log(`\nTotal: ${kb(totalSrc)} → ${kb(totalDist)} (${Math.round((1 - totalDist / totalSrc) * 100)}% smaller)`);
