// A página de entrada e a confirmação de Produtos usam o mesmo fluxo.
function prepararFormularioAcesso(form, aoEntrar, modoInicial = 'envio') {
  const email = form.querySelector('[type=email]');
  const prova = form.querySelector('[autocomplete=one-time-code]');
  const senha = form.querySelector('[autocomplete=current-password]');
  const enviar = form.querySelector('[type=submit]');
  const usarSenha = form.querySelector('[data-usar-senha]');
  const usarMensagem = form.querySelector('[data-usar-mensagem]');
  const trocar = form.querySelector('[data-reiniciar]');
  const aviso = form.querySelector('[role=status]');
  const textos = {
    envio: 'Informe o e-mail do gerente para receber o acesso.',
    prova: 'Digite o código recebido ou cole o endereço original do botão do e-mail.',
    senha: 'Use a senha cadastrada no Viera para este e-mail.'
  };
  let modo;
  let requisicao;
  let concluido = false;

  function cancelar() {
    requisicao?.abort();
    requisicao = null;
  }

  function mostrar(novoModo, focar = true) {
    cancelar();
    modo = novoModo;
    const porSenha = modo === 'senha';
    const porProva = modo === 'prova';
    prova.value = senha.value = '';
    prova.closest('.form-group').hidden = prova.disabled = !porProva;
    senha.closest('.form-group').hidden = senha.disabled = !porSenha;
    prova.required = porProva;
    senha.required = porSenha;
    // Quem chegou ao endereço público ainda precisa informar o e-mail.
    email.readOnly = porProva && Boolean(email.value) && email.validity.valid;
    enviar.disabled = false;
    enviar.textContent = porSenha ? 'Entrar com senha' : porProva ? 'Confirmar e entrar' : 'Enviar acesso por e-mail';
    usarSenha.textContent = porSenha ? 'Usar código por e-mail' : 'Usar senha';
    usarMensagem.hidden = modo !== 'envio';
    trocar.hidden = !porProva;
    aviso.textContent = textos[modo];
    if (focar) (email.value && email.validity.valid ? (porSenha ? senha : porProva ? prova : email) : email).focus();
  }

  async function executar(acao, dados) {
    if (requisicao || concluido) return;
    const requisicaoAtual = new AbortController();
    requisicao = requisicaoAtual;
    const signal = requisicaoAtual.signal;
    enviar.disabled = true;
    try {
      if (acao === 'prova') await confirmarMensagem(dados.email, prova.value.trim(), signal);
      else await requisitarAcesso(acao, dados, signal);
      if (signal.aborted) return;
      if (acao === 'enviar') {
        mostrar('prova');
      } else {
        concluido = true;
        usarSenha.disabled = usarMensagem.disabled = trocar.disabled = true;
        prova.value = senha.value = '';
        aoEntrar();
      }
    } catch (erro) {
      if (signal.aborted) return;
      if (acao === 'enviar' && erro.status === 429) {
        mostrar('prova');
        aviso.textContent = 'Aguarde antes de pedir outra mensagem. Você pode usar a mais recente ou entrar com sua senha.';
      } else {
        aviso.textContent = erro.message;
      }
    } finally {
      if (requisicao === requisicaoAtual) {
        requisicao = null;
        enviar.disabled = concluido;
      }
    }
  }

  form.reset();
  usarSenha.disabled = usarMensagem.disabled = trocar.disabled = false;
  mostrar(modoInicial, false);
  usarSenha.onclick = () => mostrar(modo === 'senha' ? 'envio' : 'senha');
  usarMensagem.onclick = () => mostrar('prova');
  trocar.onclick = () => mostrar('envio');
  form.onsubmit = evento => {
    evento.preventDefault();
    const dados = { email: email.value.trim() };
    if (modo === 'senha') dados.senha = senha.value;
    executar(modo === 'envio' ? 'enviar' : modo, dados);
  };
  return {
    retorno: codigo => executar('retorno', { codigo }),
    cancelar() { cancelar(); form.reset(); }
  };
}
