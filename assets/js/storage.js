// ======= UTILS =======

function fmtMoney(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDate(d) {
  if (!d) return '—';

  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');

  return `${day}/${m}/${y}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonth() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isSameMonth(dateStr, monthStr) {
  return dateStr && dateStr.startsWith(monthStr);
}


// ======= STATUS CONTAS A PAGAR =======

function resolveStatusPagar(c) {
  if (
    c.status === 'paga' ||
    c.status === 'paga após vencimento' || c.status === 'paga apos vencimento'
  ) {
    return c.status === 'paga apos vencimento' ? 'paga após vencimento' : c.status;
  }

  if (c.dataVencimento && c.dataVencimento < todayStr()) {
    return 'vencida';
  }

  return 'pendente';
}

function statusBadgePagar(status) {
  const map = {
    'pendente': 'badge-yellow',
    'paga': 'badge-green',
    'paga após vencimento': 'badge-blue',
    'vencida': 'badge-red'
  };

  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}


// ======= STATUS CONTAS A RECEBER =======

function resolveStatusReceber(c) {
  if (
    c.status === 'recebida' ||
    c.status === 'recebida em atraso'
  ) {
    return c.status;
  }

  if (c.dataVencimento && c.dataVencimento < todayStr()) {
    return 'atrasada';
  }

  return 'pendente';
}

function statusBadgeReceber(status) {
  const map = {
    'pendente': 'badge-yellow',
    'recebida': 'badge-green',
    'recebida em atraso': 'badge-blue',
    'atrasada': 'badge-red'
  };

  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}


// Os cadastros ficam em memória durante a sessão. O banco é a fonte compartilhada.
const tiposGestao = ['categorias','funcionarios','contasPagar','contasReceber','vales'];
const SV = {
  linhas: [], produtos: [], ocupado: false, pagina: null, pronto: false,
  get(tipo) {
    if (tipo === 'produtos') return this.produtos;
    return this.linhas.filter(r => r.tipo === tipo).map(r => ({ ...r.dados }));
  },
  newId() { return crypto.randomUUID(); },
  async ler() { this.linhas = await consultar('/api/registros'); },
  async alterar(tipo, dados, excluir = false) {
    if (this.ocupado) { showToast('Aguarde a sincronização atual.', 'info'); return false; }
    this.ocupado = true;
    try {
      const anterior = this.linhas.find(r => r.tipo === tipo && r.id === dados.id);
      const caminho = '/api/registros/' + tipo;
      const edicao = Boolean(anterior) || excluir;
      const row = await consultar(edicao ? caminho + '/' + dados.id : caminho, {
        method: excluir ? 'DELETE' : edicao ? 'PUT' : 'POST',
        headers: edicao ? { 'If-Match': String(anterior?.versao || 0) } : {},
        body: excluir ? undefined : JSON.stringify(dados)
      });
      this.linhas = this.linhas.filter(r => !(r.tipo === tipo && r.id === dados.id));
      if (!excluir) this.linhas.push(row);
      return true;
    } catch (erro) { showToast(erro.message,'warn'); return false; }
    finally { this.ocupado = false; }
  }
};
async function consultar(url, opcoes = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),15000);
  try {
    const resposta = await fetch(url, { ...opcoes, cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type':'application/json', ...opcoes.headers } });
    if (resposta.status === 401 || resposta.status === 403) {
      location.replace('../index.html');
      throw new Error('Entre novamente com o e-mail do gerente.');
    }
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
    return dados;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('A resposta demorou demais. Atualize a lista antes de tentar novamente.');
    if (err instanceof TypeError) throw new Error('Verifique sua conexão e tente novamente.');
    throw err;
  } finally { clearTimeout(timeout); }
}
async function carregarProdutos() {
  const produtos = await consultar('/api/produtos');
  if (!Array.isArray(produtos)) throw new Error('Resposta do estoque inválida.');
  SV.produtos = produtos;
  return produtos;
}
function legados() {
  const defaults = ['Fornecedor','Energia','Aluguel','Manutenção','Impostos','Folha de Pagamento','Água','Internet',
    'Vendas','Recebimento de Cliente','PIX','Cartão','Dinheiro','Outros Recebimentos'];
  return tiposGestao.flatMap(tipo => {
    const raw = localStorage.getItem('sv_' + tipo);
    if (raw === null) return [];
    const dadosLocais = JSON.parse(raw);
    if (!Array.isArray(dadosLocais)) throw new Error('Confira a cópia antiga de ' + tipo + ' neste navegador.');
    return dadosLocais.map(dados => {
      const index = tipo === 'categorias' ? defaults.indexOf(dados.nome) : -1;
      if (index >= 0 && dados.tipo === (index < 8 ? 'saida' : 'entrada'))
        dados = { ...dados, id: 'categoria-inicial-' + (index + 1) };
      return { tipo, dados };
    });
  });
}
async function importarLegados() {
  const linhas = legados();
  const produtos = JSON.parse(localStorage.getItem('sv_produtos') || '[]');
  if (!Array.isArray(produtos)) throw new Error('Confira a cópia antiga de produtos neste navegador.');
  for (const produto of produtos) {
    // IDs numéricos vieram da API. Reimportá-los poderia restaurar produtos já excluídos.
    if (Number.isSafeInteger(produto.id) || /^\d+$/.test(produto.id)) continue;
    await consultar('/api/produtos/importar', { method:'POST', body:JSON.stringify({ ...produto, preco:produto.preco ?? 0 }) });
  }
  // Funcionários precedem seus vales. A RPC registra cada ID uma única vez.
  const enviar = lote => consultar('/api/registros/importar', { method:'POST', body:JSON.stringify({linhas:lote}) });
  let lote = [], bytes = 0;
  for (const linha of linhas) {
    const tamanho = new Blob([JSON.stringify(linha)]).size + 1;
    if (lote.length && (lote.length >= 100 || bytes + tamanho > 220000)) {
      await enviar(lote); lote = []; bytes = 0;
    }
    lote.push(linha); bytes += tamanho;
  }
  if (lote.length) await enviar(lote);
  for (const tipo of tiposGestao) localStorage.removeItem('sv_' + tipo);
  localStorage.removeItem('sv_produtos'); // Cache da versão antiga, originado na API.
}
async function iniciarPagina(desenhar) {
  SV.pagina = desenhar;
  const app = document.getElementById('app');
  app.innerHTML = '<main class="page-content"><p role="status">Carregando os dados da loja…</p></main>';
  try {
    await SV.ler();
    SV.pronto = true;
    await desenhar();
    if (desenhar.name === 'render') carregarProdutos().catch(() => {}); // Alimenta a busca nas demais páginas.
    if ([...tiposGestao,'produtos'].some(t => localStorage.getItem('sv_' + t) !== null))
      showToast('Há dados da versão antiga neste navegador. Use Salvar tudo para enviá-los à loja.', 'info', 10000);
  } catch (erro) {
    SV.pronto = false;
    app.innerHTML = '<main class="page-content"><p role="alert"></p><button class="btn btn-primary" type="button">Tentar novamente</button></main>';
    app.querySelector('p').textContent = erro.message;
    app.querySelector('button').onclick = () => iniciarPagina(desenhar);
  }
}
async function atualizarPagina() {
  if (!SV.pronto || SV.ocupado || document.hidden || document.querySelector('.modal-overlay.open,dialog[open]')) return;
  SV.ocupado = true;
  try {
    const linhas = await consultar('/api/registros');
    if (document.querySelector('.modal-overlay.open,dialog[open]')) return;
    SV.linhas = linhas;
    await SV.pagina();
  }
  catch (err) { showToast(err.message,'warn'); }
  finally { SV.ocupado = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarPagina(); });
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
