async function requisitarAcesso(rota, dados, signal) {
  const resposta = await fetch('/api/gerente/' + rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados), signal
  });
  if (resposta.ok) return;
  const erro = await resposta.json().catch(() => ({}));
  throw new Error(erro.erro || 'Não foi possível confirmar o acesso do gerente.');
}

function confirmarGerente() {
  const dialogo = document.getElementById('acesso-gerente');
  if (dialogo.open) throw new Error('Já existe uma confirmação em andamento.');
  const form = document.getElementById('form-acesso-gerente');
  const email = document.getElementById('email-gerente');
  const etapa = document.getElementById('etapa-confirmacao');
  const prova = document.getElementById('prova-gerente');
  const aviso = document.getElementById('aviso-gerente');
  const confirmar = document.getElementById('confirmar-gerente');
  const reenviar = document.getElementById('reenviar-gerente');
  const cancelar = document.getElementById('cancelar-gerente');
  const requisicao = new AbortController();
  form.reset();
  email.readOnly = false;
  prova.required = false;
  etapa.hidden = true;
  reenviar.hidden = true;
  confirmar.disabled = false;
  reenviar.disabled = false;
  confirmar.textContent = 'Enviar acesso';
  aviso.textContent = 'Use o e-mail cadastrado para alterar preços, estoque ou excluir um produto.';
  dialogo.returnValue = '';

  async function enviar(reenviando) {
    if (confirmar.disabled) return;
    confirmar.disabled = true;
    reenviar.disabled = true;
    try {
      if (etapa.hidden || reenviando) {
        await requisitarAcesso('enviar', { email: email.value }, requisicao.signal);
        if (requisicao.signal.aborted) return;
        email.readOnly = true;
        etapa.hidden = false;
        reenviar.hidden = false;
        prova.required = true;
        prova.value = '';
        confirmar.textContent = 'Confirmar e continuar';
        aviso.textContent = 'Acesso enviado. Confira também a pasta de spam.';
        prova.focus();
      } else {
        await requisitarAcesso('confirmar', { email: email.value, comprovante: prova.value }, requisicao.signal);
        if (!requisicao.signal.aborted) dialogo.close('confirmado');
      }
    } catch (erro) {
      if (!requisicao.signal.aborted) aviso.textContent = erro.message;
    } finally {
      if (!requisicao.signal.aborted) {
        confirmar.disabled = false;
        reenviar.disabled = false;
      }
    }
  }

  return new Promise(resolve => {
    form.onsubmit = evento => { evento.preventDefault(); enviar(false); };
    reenviar.onclick = () => enviar(true);
    cancelar.onclick = () => dialogo.close('cancelado');
    dialogo.addEventListener('close', () => {
      requisicao.abort();
      form.onsubmit = null;
      reenviar.onclick = null;
      cancelar.onclick = null;
      prova.value = '';
      resolve(dialogo.returnValue === 'confirmado');
    }, { once: true });
    dialogo.showModal();
    email.focus();
  });
}

async function alterarComoGerente(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (resposta.status !== 401) return resposta;
  const erro = await resposta.clone().json().catch(() => ({}));
  if (erro.codigo !== 'GERENTE_NECESSARIO') return resposta;
  if (!await confirmarGerente()) throw new Error('Alteração cancelada.');
  return fetch(url, opcoes);
}
