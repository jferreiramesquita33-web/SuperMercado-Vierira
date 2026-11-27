// A página de entrada e a confirmação de Produtos usam o mesmo fluxo.
function prepararFormularioAcesso(form, aoEntrar, modoInicial = 'envio') {
  const email = form.querySelector('[type=email]');
  const prova = form.querySelector('[autocomplete=one-time-code]');
  const senha = form.querySelector('[autocomplete=current-password]');
  const enviar = form.querySelector('[type=submit]');
  const usarSenha = form.querySelector('[data-usar-senha]');
  const usarMensagem = form.querySelector('[data-usar-mensagem]');
  const criarSenha = form.querySelector('[data-criar-senha]');
  const trocar = form.querySelector('[data-reiniciar]');
  const aviso = form.querySelector('[role=status]');
  const textos = {
    envio: 'Informe o e-mail do gerente para receber o acesso.',
    aguardando: 'Abra a mensagem mais recente neste navegador e clique no botão do e-mail. O próprio link confirma o acesso.',
    prova: 'Antes de abrir o botão do e-mail, copie o endereço dele e cole aqui. Se a mensagem trouxer um código, você também pode digitá-lo.',
    senha: 'Use a senha cadastrada no Viera para este e-mail.',
    recuperar: 'Enviaremos um link ao e-mail do gerente para você escolher sua senha.'
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
    const aguardando = modo === 'aguardando';
    prova.value = senha.value = '';
    prova.closest('.form-group').hidden = prova.disabled = !porProva;
    senha.closest('.form-group').hidden = senha.disabled = !porSenha;
    prova.required = porProva;
    senha.required = porSenha;
    // Quem chegou ao endereço público ainda precisa informar o e-mail.
    email.readOnly = (porProva || aguardando) && Boolean(email.value) && email.validity.valid;
    enviar.disabled = false;
    enviar.hidden = aguardando;
    enviar.textContent = porSenha ? 'Entrar com senha' : porProva ? 'Confirmar e entrar' : 'Enviar acesso por e-mail';
    if (modo === 'recuperar') enviar.textContent = 'Enviar link para criar senha';
    usarSenha.textContent = porSenha ? 'Entrar por e-mail' : 'Usar senha';
    usarMensagem.hidden = modo !== 'envio' && !aguardando;
    if (criarSenha) criarSenha.hidden = !porSenha;
    trocar.hidden = !porProva && !aguardando;
    aviso.textContent = textos[modo];
    if (focar && !aguardando) (email.value && email.validity.valid ? (porSenha ? senha : porProva ? prova : email) : email).focus();
  }

  async function executar(acao, dados, tokenAcesso) {
    if (requisicao || concluido) return;
    const requisicaoAtual = new AbortController();
    requisicao = requisicaoAtual;
    const signal = requisicaoAtual.signal;
    enviar.disabled = true;
    try {
      const proximoPasso = acao === 'prova'
        ? await confirmarMensagem(dados.email, prova.value.trim(), signal)
        : await requisitarAcesso(acao, dados, signal, tokenAcesso);
      if (signal.aborted) return;
      if (acao === 'enviar') {
        mostrar('aguardando');
        if (dados.recuperarSenha) aviso.textContent = 'Abra a mensagem mais recente neste navegador. O botão do e-mail leva à tela Cadastrar senha.';
      } else {
        concluido = true;
        usarSenha.disabled = usarMensagem.disabled = trocar.disabled = true;
        if (criarSenha) criarSenha.disabled = true;
        prova.value = senha.value = '';
        aoEntrar(proximoPasso);
      }
    } catch (erro) {
      if (signal.aborted) return;
      if (acao === 'enviar' && erro.status === 429) {
        mostrar('aguardando');
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
  if (criarSenha) criarSenha.onclick = () => mostrar('recuperar');
  trocar.onclick = () => mostrar('envio');
  form.onsubmit = evento => {
    evento.preventDefault();
    if (modo === 'aguardando') return;
    const dados = { email: email.value.trim() };
    if (modo === 'senha') dados.senha = senha.value;
    if (modo === 'recuperar') dados.recuperarSenha = true;
    executar(modo === 'envio' || modo === 'recuperar' ? 'enviar' : modo, dados);
  };
  return {
    async retorno(dados, tokenAcesso) {
      aviso.textContent = 'Confirmando o link do e-mail…';
      for (const controle of form.elements) controle.disabled = true;
      await executar('retorno', dados, tokenAcesso);
      if (!concluido) {
        const mensagem = aviso.textContent;
        for (const controle of form.elements) controle.disabled = false;
        mostrar(dados.recuperarSenha ? 'recuperar' : 'envio', false);
        aviso.textContent = mensagem;
      }
    },
    cancelar() { cancelar(); form.reset(); }
  };
}
