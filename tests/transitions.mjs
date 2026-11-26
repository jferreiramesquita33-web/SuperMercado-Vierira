// Browser regression checks, with no npm dependencies. Run: node tests/transitions.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import estado from './loja-simulada.cjs';
import { randomUUID } from 'node:crypto';
import app from '../backend/server.js';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

const server = app.listen(0,'127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
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
  // Isolate presentation from third-party charts and the product backend.
  await cdp('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*cdn.jsdelivr.net*'] });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__openingCount = 0;
    window.__loginCovers = [];
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.matches('.sv-login-overlay')) {
        const object = node.querySelector('.sv-login-object');
        const r = object.getBoundingClientRect();
        window.__loginCovers.push({ covered: node.classList.contains('is-covered'), diameter: r.width, diagonal: Math.hypot(innerWidth,innerHeight) });
      }
    }))).observe(document, {childList:true,subtree:true});
    window.addEventListener('pagehide', () => {
      const object = document.querySelector('.sv-login-overlay[data-phase="expand"] .sv-login-object');
      if (object) sessionStorage.setItem('__login_departure', JSON.stringify({ diameter: object.getBoundingClientRect().width, diagonal: Math.hypot(innerWidth,innerHeight) }));
    });
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.matches('.sv-brand-screen, .session-overlay, .sv-loading-screen')) window.__openingCount++;
    }))).observe(document, { childList: true, subtree: true });
  ` });
  await cdp('Page.navigate', { url: `${origin}/index.html` });
  await until("!!document.querySelector('.sv-brand-screen') && !!document.body");
  assert.equal(await evaluate("document.querySelectorAll('.sv-brand-screen').length"), 1);
  await until("!!document.querySelector('.sv-brand-entry.is-contracting')");
  await evaluate("document.querySelector('.sv-entry-object').getAnimations()[0].pause()");
  for (const viewport of [{ width: 1280, height: 800 }, { width: 3440, height: 1440 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await cdp('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
    // CDP emulation does not consistently dispatch native resize events headlessly.
    await evaluate("window.dispatchEvent(new Event('resize'))");
    await delay(40);
    const frames = await evaluate(`(() => {
      const object = document.querySelector('.sv-entry-object');
      const logo = object.querySelector('img');
      const animation = object.getAnimations()[0];
      return [0, 200, 400, 600, 790].map(time => {
        animation.currentTime = time;
        const r = object.getBoundingClientRect(), l = logo.getBoundingClientRect();
        return {
          diameter: r.width, ratio: l.width / r.width,
          centered: Math.abs(r.x+r.width/2-innerWidth/2)<1 && Math.abs(r.y+r.height/2-innerHeight/2)<1,
          aligned: Math.abs(l.x+l.width/2-r.x-r.width/2)<1 && Math.abs(l.y+l.height/2-r.y-r.height/2)<1,
          covers: r.width >= Math.hypot(innerWidth, innerHeight),
          independentAnimations: logo.getAnimations().length,
          opacity: getComputedStyle(object).opacity
        };
      });
    })()`);
    assert.ok(frames[0].covers, `Full initial coverage at ${viewport.width} x ${viewport.height}: ${JSON.stringify(frames[0])}`);
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      assert.ok(frame.centered && frame.aligned, 'Logo and background must share the viewport center');
      assert.ok(Math.abs(frame.ratio - 1 / 1.7) < .001, 'Logo/background ratio must stay constant');
      assert.equal(frame.independentAnimations, 0, 'No separate animation on the logo');
      assert.equal(frame.opacity, '1', 'No background fade during contraction');
      if (i) assert.ok(frame.diameter < frames[i-1].diameter, 'Shape and logo contract together');
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await delay(40);
  if (process.argv.includes('--screenshots')) {
    for (const [name,time] of [['covered',0],['contracting',400],['centered',790]]) {
      await evaluate(`document.querySelector('.sv-entry-object').getAnimations()[0].currentTime = ${time}`);
      const shot = await cdp('Page.captureScreenshot');
      await writeFile(join(profile, `${name}.png`), Buffer.from(shot.data, 'base64'));
      console.log('Visual preview:', join(profile, `${name}.png`));
    }
  }
  await evaluate("document.querySelector('.sv-entry-object').getAnimations()[0].play()");
  await until("!!document.querySelector('.sv-brand-entry.is-finishing')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.sv-entry-object')).animationDuration"), '0.25s');
  await until("!document.querySelector('.sv-brand-screen') && !document.body.inert");
  assert.equal(await evaluate('window.__openingCount'), 1);
  async function enviarAcesso() {
    await evaluate("document.getElementById('email-gerente').value='gerente@example.test';document.getElementById('form-admin').requestSubmit()");
    await until("!document.getElementById('etapa-prova').hidden");
  }
  async function confirmar(codigo) {
    await evaluate("document.getElementById('prova-gerente').value=" + JSON.stringify(codigo) + ";document.getElementById('form-admin').requestSubmit()");
  }
  await enviarAcesso();
  await confirmar("000000");
  await until("!document.getElementById('login-btn-admin').disabled");
  assert.equal(await evaluate("localStorage.getItem('sv_logged')"), null);
  assert.equal(await evaluate("document.querySelector('.sv-login-overlay')"), null);
  await confirmar("123456");
  await evaluate("document.getElementById('form-admin').requestSubmit()");
  await until("!!document.querySelector('.sv-login-overlay')");
  assert.equal(await evaluate("document.getElementById('login-btn-admin').disabled"), true);
  assert.equal(await evaluate("document.querySelectorAll('.sv-login-overlay').length"), 1);
  await until("document.querySelector('.sv-login-overlay')?.dataset.phase === 'expand'");
  const expansion = await evaluate(`(() => {
    const object = document.querySelector('.sv-login-object');
    const animation = object.getAnimations()[0]; animation.pause();
    return [0,200,400,599].map(time => {
      animation.currentTime = time;
      const r = object.getBoundingClientRect(), l = object.querySelector('img').getBoundingClientRect();
      return { width:r.width, ratio:l.width/r.width, center:Math.abs(r.x+r.width/2-innerWidth/2)<1 && Math.abs(r.y+r.height/2-innerHeight/2)<1, alpha:getComputedStyle(object).opacity };
    });
  })()`);
  for (let i=0;i<expansion.length;i++) {
    assert.ok(expansion[i].center);
    assert.ok(Math.abs(expansion[i].ratio - 1/1.7)<.001);
    assert.equal(expansion[i].alpha,'1');
    if(i) assert.ok(expansion[i].width>expansion[i-1].width);
  }
  assert.ok(await evaluate("location.pathname.endsWith('/index.html')"), 'Never navigate before expansion completes');
  if (process.argv.includes('--screenshots')) {
    for (const [name,time] of [['login-expanding',300],['login-covered',599]]) {
      await evaluate(`document.querySelector('.sv-login-object').getAnimations()[0].currentTime = ${time}`);
      const shot = await cdp('Page.captureScreenshot');
      await writeFile(join(profile, `${name}.png`), Buffer.from(shot.data, 'base64'));
      console.log('Visual preview:', join(profile, `${name}.png`));
    }
  }
  await evaluate("document.querySelector('.sv-login-object').getAnimations()[0].play()");
  await until("location.pathname.endsWith('/dashboard.html') && !!document.querySelector('.kpi-card')");
  assert.equal(await evaluate('window.__openingCount'), 0);
  const departure = await evaluate("JSON.parse(sessionStorage.getItem('__login_departure'))");
  assert.ok(departure.diameter >= departure.diagonal, 'Login is fully covered at navigation');
  const arrival = await evaluate('window.__loginCovers[0]');
  assert.ok(arrival.covered && arrival.diameter >= arrival.diagonal, 'Dashboard starts fully covered');
  assert.equal(await evaluate("sessionStorage.getItem('sv_login_handoff')"), null);
  await until("document.querySelector('.sv-login-overlay')?.dataset.phase === 'contract'");
  assert.equal(await evaluate('document.body.inert'),true);
  if (process.argv.includes('--screenshots')) {
    await evaluate("const a=document.querySelector('.sv-login-object').getAnimations()[0];a.pause();a.currentTime=320");
    const shot = await cdp('Page.captureScreenshot');
    await writeFile(join(profile, 'dashboard-reveal.png'), Buffer.from(shot.data, 'base64'));
    console.log('Visual preview:', join(profile, 'dashboard-reveal.png'));
    await evaluate("document.querySelector('.sv-login-object').getAnimations()[0].play()");
  }
  await until("!document.querySelector('.sv-login-overlay') && !document.body.inert");
  assert.equal(await evaluate("localStorage.getItem('sv_logged')"), 'true');
  assert.equal(await evaluate("getComputedStyle(document.body).animationName"), 'none');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.page-content')).animationName"), 'none');
  const stripe = await evaluate(`(() => {
    const card = document.querySelector('.kpi-card');
    const style = getComputedStyle(card, '::before');
    return { animation: style.animationName, duration: style.animationDuration, cardAnimation: getComputedStyle(card).animationName };
  })()`);
  assert.deepEqual(stripe, { animation: 'vieira-line-color', duration: '7s', cardAnimation: 'none' });
  // Check exact palette stops without waiting for a complete loop.
  assert.deepEqual(await evaluate(`(() => {
    const card = document.querySelector('.kpi-card');
    const animation = card.getAnimations({ subtree: true }).find(a => a.animationName === 'vieira-line-color');
    animation.pause();
    return [0,1750,3500,5250,7000].map(time => {
      animation.currentTime = time; return getComputedStyle(card, '::before').backgroundColor;
    });
  })()`), ['rgb(200, 16, 46)', 'rgb(139, 111, 232)', 'rgb(37, 99, 235)', 'rgb(139, 111, 232)', 'rgb(200, 16, 46)']);
  await evaluate('toggleTheme()');
  assert.equal(await evaluate("document.body.classList.contains('theme-light')"), true);
  for (const page of ['produtos','categorias','contas-pagar','contas-receber','funcionarios','relatorios','vales','dashboard']) {
    await evaluate(`document.querySelector('a[href="${page}.html"]').click()`);
    await until(`location.pathname.endsWith('/${page}.html') && !!document.querySelector('.page-content')`);
    assert.equal(await evaluate('window.__openingCount'), 0, `No opening on ${page}`);
    assert.equal(await evaluate('window.__loginCovers.length'), 0, `No login transition on ${page}`);
    assert.equal(await evaluate('document.body.inert'), false);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.page-content')).animationName"), 'none');
  }
  await evaluate('history.back()');
  await until("location.pathname.endsWith('/vales.html') && !!document.querySelector('.page-content')");
  assert.equal(await evaluate('window.__openingCount'), 0);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate("sessionStorage.removeItem('sv_opening_seen'); goTo('dashboard.html')");
  await until("location.pathname.endsWith('/dashboard.html') && !!document.querySelector('.kpi-card')");
  assert.equal(await evaluate('window.__openingCount'), 0);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.kpi-card'),'::before').animationName"), 'none');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.sidebar-brand'),'::after').animationName"), 'none');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await evaluate('logout()');
  await until("location.pathname.endsWith('/index.html') && !!document.getElementById('form-admin')?.onsubmit && !!document.querySelector('.login-card')");
  assert.equal(await evaluate('window.__openingCount'), 0);
  assert.equal(await evaluate("localStorage.getItem('sv_logged')"), null);
  // A fresh entry while already signed in should open once at the destination.
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  const sessao = await fetch(origin+'/api/gerente/confirmar',{method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'gerente@example.test',comprovante:'123456'})});
  const token = sessao.headers.get('set-cookie').split(';')[0].split('=')[1];
  await cdp('Network.setCookie',{name:'viera_gerente',value:token,url:origin+'/api',path:'/api',httpOnly:true});
  await evaluate("sessionStorage.removeItem('sv_opening_seen'); localStorage.setItem('sv_logged','true'); location.reload()");
  await until("location.pathname.endsWith('/dashboard.html') && !!document.querySelector('.sv-brand-screen')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.sv-entry-object')).backgroundColor"), 'rgb(243, 245, 249)');
  await until("!document.querySelector('.sv-brand-screen') && !document.body.inert");
  assert.equal(await evaluate('window.__openingCount'), 1);
  await evaluate('logout(); logout()');
  await until("!!document.querySelector('.sv-brand-exit.is-exiting')");
  assert.equal(await evaluate("document.querySelectorAll('.sv-brand-screen').length"), 1);
  assert.equal(await evaluate("localStorage.getItem('sv_logged')"), 'true');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.sv-brand-exit-disc')).animationName"), 'sv-exit-cover');
  await until("location.pathname.endsWith('/index.html') && !!document.getElementById('form-admin')?.onsubmit && !!document.querySelector('.login-card')");
  assert.equal(await evaluate("localStorage.getItem('sv_logged')"), null);
  assert.equal(await evaluate('window.__openingCount'), 0, 'No second opening after logout');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await enviarAcesso(); await confirmar("123456");
  await until("location.pathname.endsWith('/dashboard.html') && !!document.querySelector('.kpi-card')");
  assert.equal(await evaluate('window.__loginCovers.length'),0);
  assert.equal(await evaluate('document.body.inert'),false);
  const senhaTeste = randomUUID();
  await evaluate("document.querySelector('button[onclick*=cadastro-senha]').click()");
  await evaluate("document.querySelector('#nova-senha').value=" + JSON.stringify(senhaTeste) +
    ";document.querySelector('#confirmar-senha').value='outra senha de teste';document.querySelector('#form-senha').requestSubmit()");
  await until("document.querySelector('#ajuda-senha').textContent.includes('diferentes')");
  await evaluate("document.querySelector('#confirmar-senha').value=document.querySelector('#nova-senha').value;document.querySelector('#form-senha').requestSubmit()");
  await until("!document.querySelector('#cadastro-senha').open");
  assert.equal(estado.senha,senhaTeste);
  await evaluate('logout()');
  await until("location.pathname.endsWith('/index.html') && !!document.querySelector('#form-admin')?.onsubmit");
  await cdp('Page.navigate', {url:origin+'/acesso'});
  await until("document.querySelector('#etapa-prova')?.hidden === false");
  assert.equal(await evaluate("document.querySelector('#email-gerente').readOnly"),false);
  await evaluate("document.querySelector('[data-reiniciar]').click()");
  estado.falhaEmail=503;
  await evaluate("document.querySelector('#email-gerente').value='gerente@example.test';document.querySelector('#form-admin').requestSubmit()");
  await until("document.querySelector('#acesso-ajuda').textContent.includes('não conseguiu enviar')");
  await evaluate("document.querySelector('[data-usar-senha]').click();document.querySelector('#senha-gerente').value='senha incorreta';document.querySelector('#form-admin').requestSubmit()");
  await until("document.querySelector('#acesso-ajuda').textContent.includes('incorretos')");
  assert.equal(await evaluate("document.querySelector('#email-gerente').value"),'gerente@example.test');
  await evaluate("document.querySelector('#senha-gerente').value="+JSON.stringify(senhaTeste)+";document.querySelector('#form-admin').requestSubmit()");
  await until("location.pathname.endsWith('/dashboard.html') && !!document.querySelector('.kpi-card')");
  await cdp('Page.navigate',{url:origin+'/pages/produtos.html'});
  await until("!!document.querySelector('#acesso-gerente') && !!document.querySelector('.page-content')");
  await evaluate("confirmarGerente().then(sim=>window.__reconfirmado=sim)");
  await evaluate("document.querySelector('[data-usar-senha]').click();document.querySelector('#email-gerente').value='gerente@example.test';document.querySelector('#senha-gerente').value="+JSON.stringify(senhaTeste)+";document.querySelector('#form-acesso-gerente').requestSubmit()");
  await until("window.__reconfirmado === true && !document.querySelector('#acesso-gerente').open");
  console.log('PASS: cadastro de senha, endereço público do código, falha no envio e autenticação por senha no login e na edição de produtos.');
  console.log('PASS: valid-login handoff covered on both documents, duplicate-click guard, reduced-motion login, single synchronized contraction, viewport coverage at desktop/ultrawide/mobile/landscape, common center/scale, 250ms finale, unchanged logout, native navigation, themes and reduced motion.');
  await cdp('Browser.close');

} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  server.close();
}
