// Um retorno PKCE só funciona com o cookie do navegador que iniciou o pedido.
function confirmarMensagem(email, valor, signal) {
  let link;
  try { link = new URL(valor); } catch { /* Códigos numéricos também são aceitos. */ }
  if (link) {
    if (link.hash) throw new Error('Use o link original da mensagem. Se já foi usado, solicite um novo acesso quando o envio estiver disponível.');
    const codigo = link.searchParams.get('code');
    if (codigo && (link.origin === location.origin || ['localhost','127.0.0.1'].includes(link.hostname)))
      return requisitarAcesso('retorno',{codigo},signal);
  }
  return requisitarAcesso('confirmar',{email,comprovante:valor},signal);
}

async function requisitarAcesso(rota, dados, signal, tokenAcesso) {
  const headers = { 'Content-Type':'application/json', 'Accept':'application/json' };
  if (tokenAcesso) headers.Authorization = 'Bearer ' + tokenAcesso;
  let resposta;
  try {
    resposta = await fetch('/api/gerente/' + rota, {
      method:'POST', headers, cache:'no-store', redirect:'error',
      body:JSON.stringify(dados), signal
    });
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro;
    throw new Error('O site não conseguiu se conectar. Confira a internet e tente novamente.');
  }
  if (resposta.status === 204) return resposta.headers.get('X-Viera-Proximo-Passo');
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
