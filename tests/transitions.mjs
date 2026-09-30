// Browser regression checks, with no npm dependencies. Run: node tests/transitions.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw Error('Outside workspace');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[extname(path)] || 'text/plain');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'vieira-motion-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(port, 'Chrome must start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id); }
  });
  async function cdp(method, params = {}) {
    const next = ++id;
    const result = new Promise(resolve => pending.set(next, resolve));
    socket.send(JSON.stringify({ id: next, method, params }));
    const reply = await result;
    if (reply.error) throw Error(JSON.stringify(reply.error));
    return reply.result;
  }
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return; } catch {}
      await delay(80);
    }
    throw Error(`Timed out: ${expression}`);
  }
  await cdp('Page.enable');
  await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] });
  await cdp('Page.navigate', { url: `${origin}/index.html` });
  await until('!!window.SVTransitions && !!document.body');
  assert.equal(await evaluate("document.documentElement.classList.contains('sv-loading')"), true);
  await until('SVTransitions.ready && !document.body.inert');
  assert.equal(await evaluate("document.querySelector('.sv-loading-screen') === null"), true);
  await evaluate("localStorage.setItem('sv_logged','true'); localStorage.setItem('sv_theme','light'); goTo('pages/categorias.html')");
  await delay(60);
  assert.equal(await evaluate("document.documentElement.classList.contains('sv-exiting')"), true);
  await until("location.pathname.endsWith('/categorias.html') && window.SVTransitions?.ready && !document.body.inert");
  assert.equal(await evaluate("document.body.classList.contains('theme-light')"), true);
  assert.equal(await evaluate(`(() => {
    const card = document.createElement('div'); card.className = 'card'; card.id = 'async-card';
    document.querySelector('.page-content').append(card); return true;
  })()`), true);
  await until("document.querySelector('#async-card').classList.contains('sv-reveal')");
  await evaluate("document.querySelector('#async-card').remove(); toggleTheme()");
  // Existing sidebar navigation and fast destination loader.
  const start = Date.now();
  await evaluate("document.querySelector('a[href=\"contas-pagar.html\"]').click()");
  await until("!!document.querySelector('.sv-loading-screen.sv-quick')");
  assert.equal(await evaluate("document.documentElement.classList.contains('sv-loading-light')"), false);
  await until("location.pathname.endsWith('/contas-pagar.html') && window.SVTransitions?.ready");
  assert.ok(Date.now() - start < 2000, 'Internal navigation should not repeat the long splash');
  await evaluate('history.back()');
  await until("location.pathname.endsWith('/categorias.html') && window.SVTransitions?.ready && !document.body.inert");
  // Modified/new-tab/external links must keep native behavior.
  assert.equal(await evaluate(`(() => {
    const link = document.createElement('a'); link.href = 'https://example.com'; document.body.append(link);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.addEventListener('click', e => setTimeout(() => {}, 0));
    const intercepted = !link.dispatchEvent(event); link.remove(); return intercepted;
  })()`), false);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp('Page.reload');
  await until("document.readyState === 'complete' && window.SVTransitions?.ready && !document.body.inert");
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('.card')).transitionDuration) < .001"));
  console.log('PASS: initial splash, exit, internal links, fast loader, theme changes, dynamic cards, back navigation, native links, mobile and reduced motion.');
} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  server.close();
}
