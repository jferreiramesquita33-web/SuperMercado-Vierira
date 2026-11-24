function historicoSemestral(pagar, receber, modo, referencia = new Date()) {
  const meses = new Map();
  const formato = new Intl.DateTimeFormat('pt-BR', { month:'short', year:'2-digit' });
  for (let i = 5; i >= 0; i--) {
    const mes = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    const chave = mes.getFullYear() + '-' + String(mes.getMonth()+1).padStart(2,'0');
    meses.set(chave, { rotulo:formato.format(mes).replace(' de ','/'), pagar:0, receber:0, quantidade:0 });
  }
  function somar(contas, lado) {
    for (const c of contas) {
      const quitada = lado === 'pagar' ? ['paga','paga após vencimento','paga apos vencimento'].includes(c.status)
        : ['recebida','recebida em atraso'].includes(c.status);
      if (modo === 'abertas' && quitada || modo === 'fluxo' && !quitada) continue;
      const vencimento = modo !== 'fluxo' ? c.dataVencimento : lado === 'pagar' ? c.dataPagamento : c.dataRecebimento;
      const mes = meses.get(vencimento?.slice(0,7));
      if (mes) { mes[lado] += Math.round(Number(c.valor) * 100); mes.quantidade++; }
    }
  }
  somar(pagar,'pagar'); somar(receber,'receber');
  return [...meses.values()];
}

function graficoSemestral(meses, titulo, pagar, receber) {
  const maximo = Math.max(1, ...meses.flatMap(m => [m.pagar,m.receber]));
  const tabela = document.createElement('div');
  tabela.className = 'historico';
  const moeda = centavos => fmtMoney(centavos / 100);
  tabela.innerHTML = '<div class="historico-legenda"><span class="leg-pagar"></span>' + pagar +
    '<span class="leg-receber"></span>' + receber + '</div>';
  const barras = document.createElement('div');
  barras.className = 'historico-barras';
  barras.setAttribute('aria-hidden','true');
  for (const m of meses) {
    const grupo = document.createElement('div');
    grupo.className = 'historico-mes';
    grupo.title = m.rotulo + ' · ' + pagar + ' ' + moeda(m.pagar) + ' · ' + receber + ' ' + moeda(m.receber);
    for (const chave of ['pagar','receber']) {
      const barra = document.createElement('i');
      barra.className = 'barra-' + chave;
      barra.style.height = (100 * m[chave] / maximo) + '%';
      grupo.appendChild(barra);
    }
    const legenda = document.createElement('small');
    legenda.textContent = m.rotulo;
    grupo.appendChild(legenda);
    barras.appendChild(grupo);
  }
  tabela.appendChild(barras);
  if (!meses.some(m => m.quantidade)) {
    const vazio = document.createElement('p');
    vazio.textContent = 'Nenhuma conta neste período.';
    tabela.appendChild(vazio);
  }
  const detalhe = document.createElement('details');
  detalhe.innerHTML = '<summary>Ver valores por mês</summary><table><caption>' + titulo +
    '</caption><thead><tr><th>Mês</th><th>' + pagar + '</th><th>' + receber + '</th></tr></thead><tbody>' +
    meses.map(m => '<tr><th scope="row">' + m.rotulo + '</th><td>' + moeda(m.pagar) + '</td><td>' + moeda(m.receber) + '</td></tr>').join('') + '</tbody></table>';
  tabela.appendChild(detalhe);
  return tabela;
}
