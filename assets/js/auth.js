// ======= AUTH =======
// Acesso exclusivo do gerente / administrador
const SV_USERS = [
  { username: 'admin', password: '123', name: 'Gerente Vieira', type: 'admin' },
  { username: 'gerente', password: 'vieira2024', name: 'Gerente Vieira', type: 'admin' },
];

function checkAuth() {
  if (localStorage.getItem('sv_logged') !== 'true') {
    window.location.href = '../index.html';
  }
}

function logout() {
  const finishLogout = () => {
    localStorage.removeItem('sv_logged');
    localStorage.removeItem('sv_user_type');
    localStorage.removeItem('sv_user_name');
    window.location.href = '../index.html';
  };

  if (typeof showGoodbye === 'function') {
    showGoodbye(finishLogout);
  } else {
    finishLogout();
  }
}
