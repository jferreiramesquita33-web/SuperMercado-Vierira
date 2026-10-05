/* A one-use visual handoff after successful authentication, never a route hook. */
(() => {
  'use strict';
  const base = new URL('../../', document.currentScript.src);
  const destination = new URL('pages/dashboard.html', base).href;
  const symbol = new URL('assets/img/logo-symbol.svg', base).href;
  const key = 'sv_login_handoff';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = null;
  let leaving = false;
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(key) || 'null');
    sessionStorage.removeItem(key);
  } catch {}
  const resuming = Boolean(pending?.phase === 'covered' && pending.url === location.href &&
    location.href === destination && Date.now() - pending.time >= 0 && Date.now() - pending.time < 30000);

  function cleanup() {
    if (!current) return;
    const state = current;
    current = null;
    clearTimeout(state.watchdog);
    state.animation?.cancel();
    window.removeEventListener('resize', state.size);
    state.overlay.remove();
    root.classList.remove('sv-login-active', 'sv-login-covered');
    if (document.body) document.body.inert = state.wasInert;
  }

  function create(covered) {
    const overlay = document.createElement('div');
    overlay.className = `sv-login-overlay${covered ? ' is-covered' : ''}`;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', 'Abrindo Dashboard Vieira');
    overlay.innerHTML = `<div class="sv-login-center"><div class="sv-login-object"><img src="${symbol}" alt="Vieira" width="240" height="286"></div></div>`;
    root.classList.add('sv-login-active');
    if (covered) root.classList.add('sv-login-covered');
    root.appendChild(overlay);
    const object = overlay.querySelector('.sv-login-object');
    const state = { overlay, object, wasInert: document.body?.inert || false, animation: null };
    state.size = () => {
      const logoWidth = Math.min(160, Math.max(112, innerWidth * .16));
      const diameter = logoWidth * 1.7;
      overlay.style.setProperty('--sv-login-logo', `${logoWidth}px`);
      overlay.style.setProperty('--sv-login-diameter', `${diameter}px`);
      overlay.style.setProperty('--sv-login-cover', Math.max(1, Math.hypot(innerWidth, innerHeight) * 1.02 / diameter));
    };
    current = state;
    state.size();
    window.addEventListener('resize', state.size, { passive: true });
    if (document.body) document.body.inert = true;
    state.watchdog = setTimeout(() => {
      cleanup();
      if (leaving) navigate(false);
    }, 12000);
    return state;
  }

  async function phase(state, name) {
    if (current !== state) return false;
    state.overlay.dataset.phase = name;
    state.animation = state.object.getAnimations()[0];
    await state.animation.finished;
    return current === state;
  }

  function navigate(continueAnimation) {
    try {
      if (continueAnimation) sessionStorage.setItem(key, JSON.stringify({ phase: 'covered', url: destination, time: Date.now() }));
      else sessionStorage.removeItem(key);
    } catch {}
    location.assign(destination);
  }

  async function start() {
    if (leaving || current) return;
    leaving = true;
    if (reduced.matches) { navigate(false); return; }
    // If handoff storage is unavailable, keep native login functional.
    try {
      sessionStorage.setItem(key, JSON.stringify({ phase: 'preparing' }));
      sessionStorage.removeItem(key);
    } catch { navigate(false); return; }
    const state = create(false);
    try {
      await state.overlay.querySelector('img').decode();
      if (!await phase(state, 'arrive')) return;
      if (!await phase(state, 'expand')) return;
      state.overlay.classList.add('is-covered');
      // Commit a fully covered frame before crossing the document boundary.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (current === state) navigate(true);
    } catch {
      if (current === state) { cleanup(); navigate(false); }
    }
  }

  async function resume() {
    if (reduced.matches) return;
    const state = create(true); // Runs in <head>, before the Dashboard can paint.
    const ready = document.readyState === 'loading'
      ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
      : Promise.resolve();
    try {
      await Promise.all([ready, state.overlay.querySelector('img').decode()]);
      if (current !== state) return;
      document.body.inert = true;
      // Keep native auth redirects authoritative if a session expired meanwhile.
      if (localStorage.getItem('sv_logged') !== 'true') { cleanup(); return; }
      root.classList.remove('sv-login-covered');
      if (!await phase(state, 'contract')) return;
      if (!await phase(state, 'finish')) return;
      cleanup();
    } catch { cleanup(); }
  }

  window.SVLoginTransition = { start, resuming };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('pageshow', event => { if (event.persisted) { cleanup(); leaving = false; } });
  reduced.addEventListener('change', event => {
    if (!event.matches) return;
    cleanup();
    if (leaving) navigate(false);
  });
  if (resuming) resume();
})();
