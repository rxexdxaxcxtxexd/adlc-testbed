// Responsive check for COI Check: phone, iPad and desktop layouts.
// Development tooling only. Nothing here deploys (.claspignore keeps scripts/ out).
//
// Run:  node scripts/checks/responsive.js [--sizes 375x812,768x1024] [--tests T4,T5] [--shots DIR] [-v]
//
// This file builds the preview from src/ into a temp folder, serves it on a free port and hands the
// browser work to responsive.py (Python Playwright, the browser stack installed on this machine).
// Exit code 1 means at least one check failed. See docs/design/responsive-spec.md section 7 for T1 to T15.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.pdf': 'application/pdf', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

function main() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-responsive-'));
  const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-preview.js')], { env: { ...process.env, PREVIEW_OUT: out }, encoding: 'utf8' });
  if (built.status !== 0) { process.stderr.write(built.stderr || 'The preview did not build.\n'); process.exit(2); }

  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(out, path.normalize(name));
    if (!file.startsWith(out) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const py = spawn('python3', [path.join(__dirname, 'responsive.py'), base, ...process.argv.slice(2)], {
      stdio: 'inherit', env: { ...process.env, COI_SAMPLE_PDF: path.join(out, 'sample-certificate.pdf') },
    });
    py.on('exit', (code) => { server.close(); fs.rmSync(out, { recursive: true, force: true }); process.exit(code === null ? 2 : code); });
  });
}

main();
