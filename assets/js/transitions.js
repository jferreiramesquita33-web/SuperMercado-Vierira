/* Brand entrance and explicit logout only. Internal links remain native. */
(() => {
  'use strict';
  const root = document.documentElement;
  const base = new URL('../../', document.currentScript.src);
  const symbol = new URL('assets/img/logo-symbol.svg', base).href;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;

  function screen(mode, onComplete) {
    root.classList.add('sv-brand-active');
    const overlay = document.createElement('div');
    overlay.className = `sv-brand-screen sv-brand-${mode}`;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', mode === 'exit' ? 'Saindo do Supermercado Vieira' : 'Abrindo Supermercado Vieira');
    let light = document.body?.classList.contains('theme-light');
    if (!document.body) {
      try { light = localStorage.getItem('sv_theme') === 'light'; } catch {}
    }
    overlay.classList.toggle('is-light', Boolean(light));
    overlay.innerHTML = mode === 'entry' ? `
      <div class="sv-entry-center"><div class="sv-entry-object">
        <img class="sv-brand-symbol" src="${symbol}" alt="Vieira" width="240" height="286">
      </div></div>` : `
      <svg class="sv-brand-curtain" aria-hidden="true" width="100%" height="100%">
        <defs><mask id="sv-brand-aperture" maskUnits="userSpaceOnUse" style="mask-type:luminance">
          <rect width="100%" height="100%" fill="white"/>
          <g class="sv-brand-mask-center"><g class="sv-brand-aperture">
            <image href="${symbol}" x="-120" y="-143" width="240" height="286" style="filter:brightness(0)"/>
          </g></g>
        </mask></defs>
        <rect class="sv-brand-curtain-fill" width="100%" height="100%" mask="url(#sv-brand-aperture)"/>
      </svg>
      <div class="sv-brand-exit-disc" aria-hidden="true"></div>
      <div class="sv-brand-center"><div class="sv-brand-zoom"><div class="sv-brand-arrival"><div class="sv-brand-rotor">
        <img class="sv-brand-symbol" src="${symbol}" alt="Vieira" width="240" height="286">
      </div></div></div></div>`;
    // Keep the viewport overlay outside the body's existing brightness filter.
    root.appendChild(overlay);
    const image = overlay.querySelector('.sv-brand-symbol');
    let done = false;
    const timers = new Map();
    const animations = new Set();
    const previousInert = document.body?.inert || false;
    function wait(ms) {
      if (done) return Promise.resolve(false);
      return new Promise(resolve => {
        const timer = setTimeout(() => { timers.delete(timer); resolve(!done); }, ms);
        timers.set(timer, resolve);
      });
    }
    function size() {
      const width = innerWidth, height = innerHeight;
      const logoWidth = Math.min(160, Math.max(112, width * .16));
      if (mode === 'entry') {
        const diameter = logoWidth * 1.7;
        overlay.style.setProperty('--sv-logo-width', `${logoWidth}px`);
        overlay.style.setProperty('--sv-entry-diameter', `${diameter}px`);
        overlay.style.setProperty('--sv-entry-cover', Math.max(1, Math.hypot(width, height) * 1.02 / diameter));
        return;
      }
      // The narrowest solid region around the mark's center must cover the diagonal.
      const cover = Math.max(24, Math.hypot(width, height) / (logoWidth * .075));
      overlay.style.setProperty('--sv-logo-width', `${logoWidth}px`);
      overlay.style.setProperty('--sv-cover-scale', cover);
      overlay.style.setProperty('--sv-mask-start', logoWidth / 240 * .92);
      overlay.style.setProperty('--sv-mask-step', logoWidth / 240 * 1.1);
      overlay.style.setProperty('--sv-mask-end', logoWidth / 240 * cover);
      overlay.style.setProperty('--sv-exit-diameter', `${Math.hypot(width, height) * 1.05}px`);
      overlay.querySelector('.sv-brand-mask-center').setAttribute('transform', `translate(${width / 2} ${height / 2})`);
    }
    function finish(complete = true) {
      if (done) return;
      done = true;
      for (const [timer, resolve] of timers) { clearTimeout(timer); resolve(false); }
      timers.clear();
      for (const animation of animations) animation.cancel();
      animations.clear();
      clearTimeout(watchdog);
      window.removeEventListener('resize', size);
      overlay.remove();
      root.classList.remove('sv-brand-active', 'sv-brand-loading', 'sv-brand-revealing');
      if (document.body) document.body.inert = previousInert;
      active = null;
      if (complete) onComplete?.();
    }
    size();
    window.addEventListener('resize', size, { passive: true });
    const watchdog = setTimeout(() => finish(), 8000);
    if (document.body) document.body.inert = true;
    active = { finish };
    async function animateEntry(phase) {
      overlay.classList.add(phase);
      const animation = overlay.querySelector('.sv-entry-object').getAnimations()[0];
      animations.add(animation);
      await animation.finished;
      animations.delete(animation);
    }
    return { overlay, image, wait, finish, animateEntry, get done() { return done; } };
  }

  async function entrance() {
    if (reduced.matches || active) return;
    root.classList.add('sv-brand-loading');
    const state = screen('entry');
    const { image, finish } = state;
    const domReady = document.readyState === 'loading'
      ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
      : Promise.resolve();
    try {
      // Reveal the live page behind a single shared logo/background transform.
      await Promise.all([domReady, image.decode()]);
      if (state.done) return;
      document.body.inert = true;
      root.classList.remove('sv-brand-loading');
      await state.animateEntry('is-contracting');
      if (state.done) return;
      await state.animateEntry('is-finishing');
      finish();
    } catch {
      // A missing asset must never hide the login or prevent use of the application.
      finish();
    }
  }

  window.showGoodbye = async onComplete => {
    if (active) return;
    if (reduced.matches) { onComplete(); return; }
    const state = screen('exit', onComplete);
    try {
      await state.image.decode();
      if (state.done) return;
      state.overlay.classList.add('is-exiting');
      if (await state.wait(1000)) state.finish();
    } catch { state.finish(); }
  };
  // Always define the logout hook, including documents which skip the opening.
  window.addEventListener('pageshow', event => { if (event.persisted) active?.finish(false); });
  window.addEventListener('pagehide', () => active?.finish(false));
  reduced.addEventListener('change', event => { if (event.matches) active?.finish(); });

  if (window.SVLoginTransition?.resuming) return;

  const onLogin = location.pathname === base.pathname || location.pathname === new URL('index.html', base).pathname;
  try {
    const logged = localStorage.getItem('sv_logged') === 'true';
    if ((onLogin && logged) || (!onLogin && !logged)) return;
    if (sessionStorage.getItem('sv_opening_seen') === 'true') return;
    sessionStorage.setItem('sv_opening_seen', 'true');
  } catch {
    if (document.referrer && new URL(document.referrer).origin === location.origin) return;
  }
  entrance();
})();
