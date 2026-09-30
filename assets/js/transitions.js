/* Shared visual lifecycle for the existing multi-page application. */
(() => {
  'use strict';
  const root = document.documentElement;
  const base = new URL('../../', document.currentScript.src);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'sv_visual_navigation';
  let fast = false;
  try {
    const pending = JSON.parse(sessionStorage.getItem(key) || 'null');
    sessionStorage.removeItem(key);
    fast = pending?.url === location.href && Date.now() - pending.time < 15000;
    root.classList.toggle('sv-loading-light', localStorage.getItem('sv_theme') === 'light');
  } catch { /* Storage restrictions must not prevent navigation. */ }

  root.classList.add('sv-motion', 'sv-loading');
  let overlay, navigating = false, finished = false, releaseTimer;
  const started = performance.now();
  const wait = ms => new Promise(resolve => setTimeout(resolve, reduced.matches ? 0 : ms));
  const revealed = new WeakSet();
  const selectors = '.topbar, .section-header, .page-content > .alert, .stat-card, .kpi-card, .card, .login-brand, .login-card, .login-footer';

  function revealElements() {
    let index = 0;
    document.querySelectorAll(selectors).forEach(element => {
      if (revealed.has(element)) return;
      revealed.add(element);
      element.style.setProperty('--sv-delay', `${Math.min(index++ * 45, 225)}ms`);
      element.classList.add('sv-reveal');
      setTimeout(() => element.classList.remove('sv-reveal'), 900);
    });
  }

  function loadingScreen() {
    if (overlay) return overlay;
    if (document.body) root.classList.toggle('sv-loading-light', document.body.classList.contains('theme-light'));
    overlay = document.createElement('div');
    overlay.className = `sv-loading-screen${fast || navigating ? ' sv-quick' : ''}`;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `<div class="sv-logo-wrap"><img class="sv-loading-logo" alt="Supermercado Vieira" src="${new URL('assets/img/logo-vieira.png', base).href}"><span class="sv-logo-shine" aria-hidden="true"></span></div><div class="sv-loading-indicator" aria-hidden="true"><span></span></div><span class="sv-sr-only">Carregando página…</span>`;
    // Outside body: the existing brightness filter creates a fixed containing block.
    root.appendChild(overlay);
    return overlay;
  }

  function animatedPage() {
    revealElements();
    root.classList.add('sv-entering');
    setTimeout(() => {
      root.classList.remove('sv-entering');
      document.querySelectorAll('.sv-reveal').forEach(element => element.classList.remove('sv-reveal'));
    }, 900);
  }

  async function finishLoading() {
    if (finished) return;
    finished = true;
    clearTimeout(releaseTimer);
    await wait(Math.max(0, (fast ? 80 : 1200) - (performance.now() - started)));
    overlay?.classList.add('sv-leaving');
    await wait(fast ? 150 : 250);
    overlay?.remove();
    overlay = null;
    root.classList.remove('sv-loading');
    if (document.body) document.body.inert = false;
    animatedPage();
    document.dispatchEvent(new Event('sv:page-ready'));
  }

  async function navigate(href) {
    const url = new URL(href, location.href);
    if (navigating) return;
    if (reduced.matches || url.origin !== location.origin) {
      location.assign(url.href);
      return;
    }
    navigating = true;
    root.classList.remove('sv-entering');
    root.classList.add('sv-exiting');
    document.body.inert = true;
    await wait(180);
    loadingScreen();
    root.classList.add('sv-loading');
    await wait(220);
    try { sessionStorage.setItem(key, JSON.stringify({ url: url.href, time: Date.now() })); } catch {}
    location.assign(url.href);
    // Recover if a browser/unload prompt cancels navigation.
    setTimeout(reset, 4000);
  }

  function reset() {
    navigating = false;
    overlay?.remove();
    overlay = null;
    root.classList.remove('sv-loading', 'sv-exiting', 'sv-entering');
    if (document.body) document.body.inert = false;
  }

  window.SVTransitions = { navigate, get ready() { return !root.classList.contains('sv-loading'); } };
  loadingScreen();
  document.addEventListener('DOMContentLoaded', () => {
    document.body.inert = true;
    loadingScreen();
    const observer = new MutationObserver(records => {
      if (window.SVTransitions.ready && !navigating && records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) revealElements();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Do not leave the UI blocked by unavailable third-party resources.
    releaseTimer = setTimeout(finishLoading, Math.max(0, 1800 - (performance.now() - started)));
    if (document.readyState === 'complete') finishLoading();
  }, { once: true });
  window.addEventListener('load', finishLoading, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.origin !== location.origin) return;
    if (!url.pathname.startsWith(base.pathname) || !url.pathname.endsWith('.html')) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    event.preventDefault();
    if (url.href !== location.href) navigate(url.href);
  });
})();
