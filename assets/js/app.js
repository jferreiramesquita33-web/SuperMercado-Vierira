// ======= TOAST SYSTEM =======
function showToast(msg, type = 'success', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warn:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icons[type]||icons.info}<span>${msg}</span>`;
  container.appendChild(t);
  const remove = () => { t.classList.add('out'); setTimeout(() => t.remove(), 320); };
  setTimeout(remove, duration);
  t.addEventListener('click', remove);
}

// ======= CONFIRM DIALOG =======
function showConfirm(msg, onConfirm, opts = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal confirm-modal">
      <div class="confirm-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h3>${opts.title || 'Confirmar ação'}</h3>
      <p>${msg}</p>
      <div class="modal-footer" style="justify-content:center;margin-top:22px">
        <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
        <button class="btn btn-danger" id="confirm-ok">${opts.okLabel||'Excluir'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirm-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#confirm-ok').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

// ======= ANIMATED COUNTER =======
function animateValue(el, from, to, duration = 800, prefix = '', suffix = '') {
  const start = performance.now();
  const forceFloat = arguments.length > 6 ? arguments[6] : false;
  const isFloat = forceFloat || String(to).includes('.');
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    el.textContent = prefix + (isFloat
      ? current.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.floor(current).toLocaleString('pt-BR')) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ======= SIDEBAR =======
function renderSidebar(active) {
  const nav = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>` },
    { section: 'Financeiro' },
    { id: 'contas-pagar', label: 'Contas a Pagar', href: 'contas-pagar.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>` },
    { id: 'contas-receber', label: 'Contas a Receber', href: 'contas-receber.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 15v-2M10 14h4"/></svg>` },
    { section: 'Cadastros' },
    { id: 'categorias', label: 'Categorias', href: 'categorias.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h8M4 18h8"/><circle cx="19" cy="15" r="3"/></svg>` },
    { id: 'produtos', label: 'Produtos', href: 'produtos.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>` },
    { id: 'funcionarios', label: 'Funcionários', href: 'funcionarios.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
    { id: 'vales', label: 'Vales', href: 'vales.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>` },
    { section: 'Relatórios' },
    { id: 'relatorios', label: 'Relatórios', href: 'relatorios.html', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
  ];

  const savedBrightness = localStorage.getItem('sv_brightness') || '100';
  const bVal = parseInt(savedBrightness);
  const savedTheme = localStorage.getItem('sv_theme') || 'dark';
  const themeLabel = savedTheme === 'light' ? 'Modo escuro' : 'Modo claro';
  const themeIcon = savedTheme === 'light'
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const userType = localStorage.getItem('sv_user_type') || 'admin';
  const userName = localStorage.getItem('sv_user_name') || 'Administrador';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = 'Gerente';

  let html = `<aside class="sidebar" id="main-sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon site-brand-icon">
        <img src="../assets/img/logo-icon.png" alt="Vieira" class="brand-logo-img" onerror="this.style.display='none'">
      </div>
      <div>
        <div class="brand-name">Supermercado Vieira</div>
        <div class="brand-sub">Gestão Financeira</div>
      </div>
    </div>
    <nav class="sidebar-nav">`;

  nav.forEach(item => {
    if (item.section) {
      html += `<div class="nav-section">${item.section}</div>`;
    } else {
      html += `<a href="${item.href}" class="nav-item ${active === item.id ? 'active' : ''}" onclick="navClick(this)">${item.icon}<span>${item.label}</span></a>`;
    }
  });

  html += `</nav>

    <div class="sidebar-settings">
      <button class="settings-btn" type="button" onclick="toggleTheme()" id="theme-toggle-btn" title="Alternar tema">
        ${themeIcon}
        <span id="theme-toggle-label">${themeLabel}</span>
      </button>
      <button class="settings-btn" type="button" onclick="document.getElementById('site-image-input').click()" title="Mudar imagem do site">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span>Mudar imagem</span>
      </button>
      <input type="file" id="site-image-input" accept="image/*" style="display:none" onchange="changeSiteImage(this)">
    </div>

    <div class="brightness-control">
      <div class="brightness-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        Brilho
      </div>
      <div class="brightness-row">
        <svg class="brightness-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
        <input type="range" class="brightness-slider" id="brightness-slider" min="30" max="100" value="${bVal}" oninput="applyBrightness(this.value)">
        <svg class="brightness-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <span class="brightness-val" id="brightness-val">${bVal}%</span>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">${userInitial}</div>
        <div>
          <div class="user-name">${userName}</div>
          <div class="user-role">${userRole}</div>
        </div>
      </div>
      <button class="logout-btn" onclick="logout()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sair do sistema
      </button>
    </div>
  </aside>
  <div class="mobile-overlay" id="mobile-overlay" onclick="closeMobileSidebar()"></div>`;

  return html;
}

// ======= NAV CLICK ANIMATION =======
function navClick(el) {
  el.style.transform = 'scale(0.96)';
  setTimeout(() => { el.style.transform = ''; }, 150);
}

// ======= MOBILE SIDEBAR =======
function toggleMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
  document.body.classList.toggle('mobile-menu-open', sidebar && sidebar.classList.contains('mobile-open'));
}
function closeMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('show');
  document.body.classList.remove('mobile-menu-open');
}

// ======= BRIGHTNESS =======
function applyBrightness(val) {
  const pct = parseInt(val);
  document.body.style.filter = `brightness(${pct / 100})`;
  const valEl = document.getElementById('brightness-val');
  if (valEl) valEl.textContent = pct + '%';
  localStorage.setItem('sv_brightness', pct);
  const slider = document.getElementById('brightness-slider');
  if (slider) {
    const pos = ((pct - 30) / 70) * 100;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pos}%, var(--border) ${pos}%, var(--border) 100%)`;
  }
}
function initBrightness() {
  const saved = localStorage.getItem('sv_brightness') || '100';
  applyBrightness(saved);
  initTheme();
  applySiteImage();
}

// ======= THEME =======
function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', nextTheme === 'light');
  localStorage.setItem('sv_theme', nextTheme);

  const label = document.getElementById('theme-toggle-label');
  const btn = document.getElementById('theme-toggle-btn');
  if (label) label.textContent = nextTheme === 'light' ? 'Modo escuro' : 'Modo claro';
  if (btn) {
    btn.querySelector('svg')?.remove();
    btn.insertAdjacentHTML('afterbegin', nextTheme === 'light'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`);
  }
}
function initTheme() {
  applyTheme(localStorage.getItem('sv_theme') || 'dark');
}
function toggleTheme() {
  const current = localStorage.getItem('sv_theme') || 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

// ======= SITE IMAGE =======
function applySiteImage() {
  const image = localStorage.getItem('sv_site_image');
  document.querySelectorAll('.site-brand-icon, .login-brand .brand-icon').forEach(icon => {
    if (image) {
      icon.style.backgroundImage = `url("${image}")`;
      icon.classList.add('site-image-active');
    } else {
      icon.style.backgroundImage = '';
      icon.classList.remove('site-image-active');
    }
  });
}

function getLogoPath() {
  // Resolve logo path whether we are on index or inside pages/
  const inPages = /\/pages\//.test(window.location.pathname) || window.location.pathname.endsWith('pages');
  return inPages ? '../assets/img/logo-icon.png' : 'assets/img/logo-icon.png';
}
function changeSiteImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Escolha um arquivo de imagem.', 'warn');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      localStorage.setItem('sv_site_image', reader.result);
      applySiteImage();
      showToast('Imagem do site atualizada.', 'success');
    } catch {
      showToast('Imagem muito grande. Tente uma imagem menor.', 'error');
    }
    input.value = '';
  };
  reader.readAsDataURL(file);
}

// ======= TOPBAR =======
function topbar(title) {
  const now = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const userName = localStorage.getItem('sv_user_name') || 'Admin';
  const userType = localStorage.getItem('sv_user_type') || 'admin';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = 'Gerente';
  const contas = (JSON.parse(localStorage.getItem('sv_contasPagar')) || []);
  const vencidas = contas.filter(c => {
    if (c.status === 'paga' || c.status === 'paga após vencimento') return false;
    return c.dataVencimento && c.dataVencimento < new Date().toISOString().split('T')[0];
  }).length;

  return `<div class="topbar">
    <div style="display:flex;align-items:center;gap:12px;">
      <button class="mobile-menu-btn" onclick="toggleMobileSidebar()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <span class="topbar-title">${title}</span>
    </div>
    <div class="topbar-right">
      <div class="topbar-search" id="topbar-search">
        <button type="button" class="search-toggle-btn" onclick="toggleTopbarSearch()" aria-label="Pesquisar" title="Pesquisar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <div class="search-input-wrap" id="search-input-wrap">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Pesquisar..." id="topbar-search-input" oninput="handleSearch(this.value)" onblur="setTimeout(()=>closeSearch(),200)">
          <button type="button" class="search-close-btn" onclick="toggleTopbarSearch()" aria-label="Fechar busca" title="Fechar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="search-results" id="search-results"></div>
        </div>
      </div>
      <button class="notif-btn" onclick="showNotifications()" title="Notificações">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        ${vencidas > 0 ? `<span class="notif-badge">${vencidas > 9 ? '9+' : vencidas}</span>` : ''}
      </button>
      <div class="topbar-user">
        <div class="topbar-user-avatar">${userInitial}</div>
        <div class="topbar-user-info">
          <div class="topbar-user-name">${userName}</div>
          <div class="topbar-user-role">${userRole}</div>
        </div>
      </div>
      <span class="topbar-date" style="display:none">${now}</span>
    </div>
  </div>`;
}

// ======= SEARCH =======
function toggleTopbarSearch() {
  const wrap = document.getElementById('topbar-search');
  if (!wrap) return;
  const opening = !wrap.classList.contains('search-active');
  wrap.classList.toggle('search-active', opening);
  const input = document.getElementById('topbar-search-input');
  if (opening) {
    setTimeout(() => { if (input) input.focus(); }, 150);
  } else if (input) {
    input.value = '';
    closeSearch();
  }
}
function handleSearch(q) {
  const res = document.getElementById('search-results');
  if (!res) return;
  q = q.trim().toLowerCase();
  if (!q) { res.classList.remove('open'); return; }

  const products = [
    'Arroz', 'Feijão', 'Açúcar', 'Café', 'Óleo', 'Sal', 'Farinha', 'Leite', 'Manteiga', 'Macarrão',
    'Sabão', 'Detergente', 'Shampoo', 'Papel Higiênico', 'Refrigerante', 'Suco', 'Biscoito', 'Pão'
  ];
  const produtosCadastrados = (JSON.parse(localStorage.getItem('sv_produtos')) || []).map(p => p.nome);
  const funcionarios = (JSON.parse(localStorage.getItem('sv_funcionarios')) || []).map(f => f.nome);
  const pages = [
    { label: 'Dashboard', href: 'dashboard.html', type: 'Página' },
    { label: 'Contas a Pagar', href: 'contas-pagar.html', type: 'Página' },
    { label: 'Contas a Receber', href: 'contas-receber.html', type: 'Página' },
    { label: 'Produtos', href: 'produtos.html', type: 'Página' },
    { label: 'Funcionários', href: 'funcionarios.html', type: 'Página' },
    { label: 'Relatórios', href: 'relatorios.html', type: 'Página' },
  ];

  let results = [];
  pages.filter(p => p.label.toLowerCase().includes(q)).forEach(p => results.push({ label: p.label, type: p.type, href: p.href }));
  funcionarios.filter(f => f.toLowerCase().includes(q)).slice(0,3).forEach(f => results.push({ label: f, type: 'Funcionário', href: 'funcionarios.html' }));
  [...produtosCadastrados, ...products]
    .filter((p, i, arr) => p && arr.indexOf(p) === i && p.toLowerCase().includes(q))
    .slice(0,3)
    .forEach(p => results.push({ label: p, type: 'Produto', href: 'produtos.html' }));

  if (!results.length) { res.classList.remove('open'); return; }
  res.innerHTML = results.slice(0,6).map(r => `
    <div class="search-result-item" onclick="location.href='${r.href}'">
      <span>${r.label}</span>
      <span class="result-type">${r.type}</span>
    </div>`).join('');
  res.classList.add('open');
}
function closeSearch() {
  const res = document.getElementById('search-results');
  if (res) res.classList.remove('open');
}

// ======= NOTIFICATIONS =======
function showNotifications() {
  const contas = (JSON.parse(localStorage.getItem('sv_contasPagar')) || []);
  const today = new Date().toISOString().split('T')[0];
  const vencidas = contas.filter(c => {
    if (c.status === 'paga' || c.status === 'paga após vencimento') return false;
    return c.dataVencimento && c.dataVencimento < today;
  });
  if (!vencidas.length) { showToast('Sem notificações pendentes', 'info'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <div class="modal-header">
      <span class="modal-title">🔔 Notificações</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${vencidas.map(c=>`<div class="alert alert-error" style="margin:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div><strong>${c.descricao}</strong> — venceu em ${fmtDate(c.dataVencimento)} · ${fmtMoney(c.valor)}</div>
      </div>`).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

// ======= TRANSIÇÃO DE ENTRADA/SAÍDA ENTRE PÁGINAS =======
// Ao clicar em qualquer link interno (menu lateral, breadcrumbs, etc.),
// espera a animação de saída terminar antes de navegar de fato.
const SV_EXIT_MS = 260;

function goTo(url) {
  if (document.body.classList.contains('page-exit')) return;
  document.body.classList.add('page-exit');
  setTimeout(() => { window.location.href = url; }, SV_EXIT_MS);
}

// ======= BOAS-VINDAS E DESPEDIDA =======
// A mensagem de boas-vindas é mostrada uma vez, logo após o login.
function showSessionOverlay(mode, onComplete) {
  if (document.getElementById('session-overlay')) return;

  const name = localStorage.getItem('sv_user_name') || 'Gerente';
  const isWelcome = mode === 'welcome';
  const overlay = document.createElement('div');
  overlay.id = 'session-overlay';
  overlay.className = `session-overlay session-overlay--${mode}`;
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `
    <div class="session-overlay__glow"></div>
    <div class="session-overlay__card">
      <div class="session-overlay__icon" aria-hidden="true">
        ${isWelcome
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'}
      </div>
      <p class="session-overlay__eyebrow">Supermercado Vieira</p>
      <h1>${isWelcome ? `Bem-vindo, ${name}!` : `Até logo, ${name}.`}</h1>
      <p>${isWelcome ? 'Seu painel está pronto para começar.' : 'Sua sessão foi encerrada com segurança.'}</p>
      <div class="session-overlay__bar"><span></span></div>
    </div>`;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  const duration = isWelcome ? 1650 : 1200;
  window.setTimeout(() => {
    overlay.classList.add('is-leaving');
    window.setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, 300);
  }, duration);
}

function showGoodbye(onComplete) {
  showSessionOverlay('goodbye', onComplete);
}

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('sv_show_welcome') === 'true') {
    sessionStorage.removeItem('sv_show_welcome');
    showSessionOverlay('welcome');
  }
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abrir em nova aba etc.
  // apenas links internos (mesmo site), como páginas .html do sistema
  e.preventDefault();
  goTo(href);
});
