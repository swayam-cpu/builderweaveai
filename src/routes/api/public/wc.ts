import { createFileRoute } from "@tanstack/react-router";
import { WEBCONTAINER_CLIENT_ID } from "@/lib/project-template";

// Cross-origin isolated host page for WebContainer. Opened as a TOP-LEVEL window
// from the builder (isolation cannot be inherited into a non-isolated parent page).
const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cache-Control": "no-store",
};

function page(clientId: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Weave — Live Dev Server</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; height:100vh; display:flex; flex-direction:column; background:#fff; color:#0f172a; }
  header { display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid #e5e7eb; }
  header strong { font-size:14px; }
  #status { font-size:12px; color:#64748b; flex:1; }
  button { font:inherit; font-size:12px; padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; }
  button.primary { background:#0f172a; color:#fff; border-color:#0f172a; }
  button[disabled] { opacity:.5; cursor:default; }
  main { flex:1; display:flex; min-height:0; }
  iframe { flex:1; border:0; background:#fff; }
  pre { margin:0; width:340px; overflow:auto; background:#0b1220; color:#a5f3d0; font-size:11px; padding:10px; white-space:pre-wrap; border-left:1px solid #1e293b; }
</style>
</head>
<body>
<header>
  <strong>Weave dev server</strong>
  <span id="status">Booting…</span>
  <button id="build" class="primary" disabled>Build &amp; save for publish</button>
</header>
<main>
  <iframe id="preview" title="App preview" allow="cross-origin-isolated"></iframe>
  <pre id="log"></pre>
</main>
<script type="module">
import { WebContainer, auth } from 'https://esm.sh/@webcontainer/api@1.6.1';

const CLIENT_ID = ${JSON.stringify(clientId)};
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const buildBtn = document.getElementById('build');

function log(line) {
  logEl.textContent += line;
  logEl.scrollTop = logEl.scrollHeight;
}
function status(text) { statusEl.textContent = text; }

function toTree(files) {
  const tree = {};
  for (const path of Object.keys(files)) {
    const parts = path.split('/').filter(Boolean);
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node[part] = { file: { contents: files[path] } };
      } else {
        if (!node[part]) node[part] = { directory: {} };
        node = node[part].directory;
      }
    }
  }
  return tree;
}

let wc = null;
let booted = false;

async function pipe(proc) {
  proc.output.pipeTo(new WritableStream({ write(chunk) { log(chunk); } }));
  return proc.exit;
}

async function start(files) {
  if (booted) { await remount(files); return; }
  booted = true;
  try {
    status('Authenticating WebContainer…');
    auth.init({ clientId: CLIENT_ID, scope: '' });
    status('Booting container…');
    wc = await WebContainer.boot({ coep: 'credentialless' });
    wc.on('server-ready', function (port, url) {
      previewEl.src = url;
      status('Dev server ready on port ' + port);
      buildBtn.disabled = false;
    });
    wc.on('error', function (err) { log('\\n[error] ' + (err && err.message) + '\\n'); });

    await wc.mount(toTree(files));
    status('Installing dependencies…');
    const install = await pipe(await wc.spawn('npm', ['install']));
    if (install !== 0) { status('npm install failed'); return; }
    status('Starting dev server…');
    pipe(await wc.spawn('npm', ['run', 'dev']));
  } catch (err) {
    booted = false;
    status('Failed: ' + (err && err.message ? err.message : String(err)));
    log('\\n' + (err && err.stack ? err.stack : String(err)) + '\\n');
  }
}

async function remount(files) {
  status('Applying changes…');
  await wc.mount(toTree(files));
  status('Files updated — dev server reloading');
}

async function collectDist(dir, out) {
  const entries = await wc.fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = dir + '/' + entry.name;
    if (entry.isDirectory()) {
      await collectDist(full, out);
    } else {
      try {
        out[full.replace('/dist/', '')] = await wc.fs.readFile(full, 'utf-8');
      } catch (e) { log('\\n[skip binary] ' + full + '\\n'); }
    }
  }
  return out;
}

buildBtn.addEventListener('click', async function () {
  if (!wc) return;
  buildBtn.disabled = true;
  status('Building for production…');
  const code = await pipe(await wc.spawn('npm', ['run', 'build']));
  if (code !== 0) { status('Build failed'); buildBtn.disabled = false; return; }
  const dist = await collectDist('/dist', {});
  if (window.opener) window.opener.postMessage({ type: 'weave:dist', dist: dist }, '*');
  status('Build saved — you can publish now');
  buildBtn.disabled = false;
});

window.addEventListener('message', function (event) {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'weave:files' && msg.files) start(msg.files);
});

if (window.opener) {
  window.opener.postMessage({ type: 'weave:wc-ready' }, '*');
  status('Waiting for project files…');
} else {
  status('Open this from the Weave builder.');
}
</script>
</body>
</html>`;
}

export const Route = createFileRoute("/api/public/wc")({
  server: {
    handlers: {
      GET: async () => new Response(page(WEBCONTAINER_CLIENT_ID), { headers: HEADERS }),
    },
  },
});
