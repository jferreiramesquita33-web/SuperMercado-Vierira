async function requisitarAcesso(rota, dados, signal) {
  let resposta;
  try {
    resposta = await fetch('/api/gerente/' + rota, {
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, cache:'no-store',
      body:JSON.stringify(dados), signal
    });
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro;
    throw new Error('O site não conseguiu se conectar. Confira a internet e tente novamente.');
  }
  if (resposta.status === 204) return;
  const json = resposta.headers.get('Content-Type')?.includes('application/json')
    ? await resposta.json().catch(() => null) : null;
  const mensagem = typeof json?.erro === 'string' ? json.erro : resposta.status === 429
    ? 'O limite de envios foi atingido. Use a mensagem mais recente ou tente mais tarde.'
    : 'O serviço de acesso está indisponível neste endereço. Tente novamente em instantes.';
  const erro = new Error(mensagem);
  erro.status = resposta.status;
  throw erro;
}

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
