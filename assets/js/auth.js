async function logout() {
  const terminar = async () => {
    try {
      const res = await fetch('/api/gerente/sair', { method: 'POST', cache:'no-store' });
      if (!res.ok) throw new Error();
      localStorage.removeItem('sv_logged');
      localStorage.removeItem('sv_user_type');
      localStorage.removeItem('sv_user_name');
      location.replace('../index.html');
    } catch { showToast('Não foi possível encerrar a sessão. Confira a conexão e tente novamente.', 'warn'); }
  };
  if (typeof showGoodbye === 'function') showGoodbye(terminar);
  else await terminar();
}
