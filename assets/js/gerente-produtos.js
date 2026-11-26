function confirmarGerente() {
  const dialogo = document.getElementById('acesso-gerente');
  if (dialogo.open) throw new Error('Já existe uma confirmação em andamento.');
  const form = document.getElementById('form-acesso-gerente');
  const acesso = prepararFormularioAcesso(form, () => dialogo.close('confirmado'));
  dialogo.returnValue = '';
  return new Promise(resolve => {
    document.getElementById('cancelar-gerente').onclick = () => dialogo.close('cancelado');
    dialogo.addEventListener('close', () => {
      acesso.cancelar();
      resolve(dialogo.returnValue === 'confirmado');
    }, { once: true });
    dialogo.showModal();
    form.querySelector('[type=email]').focus();
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
