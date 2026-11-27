// Modo visitante: mostra o sistema completo com dados de demonstração.
// Nada sai do navegador. As chamadas à API são respondidas aqui mesmo e o banco real nunca é consultado.
(function () {
  const CHAVE_MODO = 'sv_visitante';
  const CHAVE_DADOS = 'sv_visitante_dados';
  const nasPaginas = /\/pages\//.test(location.pathname);

  function ativo() {
    try { return sessionStorage.getItem(CHAVE_MODO) === '1'; } catch { return false; }
  }

  window.entrarComoVisitante = function () {
    try {
      sessionStorage.setItem(CHAVE_MODO, '1');
      sessionStorage.removeItem(CHAVE_DADOS);
      localStorage.setItem('sv_logged', 'true');
    } catch {
      alert('Este navegador bloqueou o armazenamento local. Libere os cookies do site para usar o modo visitante.');
      return;
    }
    if (window.SVLoginTransition) window.SVLoginTransition.start();
    else location.replace('/pages/dashboard.html');
  };

  // Na tela de login o modo é sempre encerrado: um gerente que entrar nesta aba verá os dados reais.
  if (!nasPaginas) {
    try { sessionStorage.removeItem(CHAVE_MODO); sessionStorage.removeItem(CHAVE_DADOS); } catch {}
  }
  window.SV_VISITANTE = nasPaginas && ativo();
  if (!window.SV_VISITANTE) return;

  // ===== Dados de demonstração (datas relativas a hoje) =====
  function dia(deslocamento) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dadosIniciais() {
    const nomesCategorias = ['Fornecedor','Energia','Aluguel','Manutenção','Impostos','Folha de Pagamento','Água','Internet',
      'Vendas','Recebimento de Cliente','PIX','Cartão','Dinheiro','Outros Recebimentos'];
    const categorias = nomesCategorias.map((nome, i) => ({ id: 'categoria-inicial-' + (i + 1), nome, tipo: i < 8 ? 'saida' : 'entrada' }));

    const funcionarios = [
      { id: 'demo-func-1', nome: 'Ana Souza', cpf: '000.000.001-00', cargo: 'Caixa', telefone: '(61) 90000-0001', salario: 1900, cargaHoraria: 44, admissao: dia(-420), status: 'ativo' },
      { id: 'demo-func-2', nome: 'Bruno Lima', cpf: '000.000.002-00', cargo: 'Repositor', telefone: '(61) 90000-0002', salario: 1750, cargaHoraria: 44, admissao: dia(-300), status: 'ativo' },
      { id: 'demo-func-3', nome: 'Carla Mendes', cpf: '000.000.003-00', cargo: 'Açougueira', telefone: '(61) 90000-0003', salario: 2300, cargaHoraria: 44, admissao: dia(-610), status: 'ativo' },
      { id: 'demo-func-4', nome: 'Diego Rocha', cpf: '000.000.004-00', cargo: 'Estoquista', telefone: '(61) 90000-0004', salario: 1850, cargaHoraria: 40, admissao: dia(-150), status: 'ativo' },
      { id: 'demo-func-5', nome: 'Elisa Prado', cpf: '000.000.005-00', cargo: 'Fiscal de caixa', telefone: '(61) 90000-0005', salario: 2100, cargaHoraria: 44, admissao: dia(-800), status: 'inativo' }
    ];

    const vales = [
      { id: 'demo-vale-1', funcionarioId: 'demo-func-1', valor: 200, data: dia(-3), motivo: 'Adiantamento' },
      { id: 'demo-vale-2', funcionarioId: 'demo-func-2', valor: 150, data: dia(-8), motivo: 'Transporte' },
      { id: 'demo-vale-3', funcionarioId: 'demo-func-3', valor: 300, data: dia(-12), motivo: 'Adiantamento' },
      { id: 'demo-vale-4', funcionarioId: 'demo-func-1', valor: 100, data: dia(-40), motivo: 'Farmácia' }
    ];

    const contasPagar = [];
    const contasReceber = [];
    const fornecedores = [['Distribuidora Central','Fornecedor',4800],['Neoenergia','Energia',1350],['Imobiliária Planalto','Aluguel',3500],
      ['Caesb','Água',420],['Net Fibra','Internet',189.9],['Receita Federal','Impostos',2100]];
    // Seis meses de contas para preencher o gráfico do dashboard.
    for (let mes = 5; mes >= 0; mes--) {
      fornecedores.forEach(([fornecedor, categoria, base], i) => {
        const venc = dia(-mes * 30 + i * 3 - 6);
        const valor = Math.round(base * (0.9 + ((mes + i) % 4) * 0.07) * 100) / 100;
        let status = 'pendente', dataPagamento;
        if (mes > 0 || i < 2) { status = 'paga'; dataPagamento = venc; }
        if (mes === 1 && i === 3) { status = 'paga após vencimento'; dataPagamento = dia(-mes * 30 + i * 3 - 2); }
        if (mes === 0 && i === 2) { status = 'vencida'; dataPagamento = undefined; }
        const conta = { id: `demo-pagar-${mes}-${i}`, descricao: `${categoria} · ${fornecedor}`, categoria, valor,
          dataVencimento: venc, fornecedor, status, observacao: '' };
        if (dataPagamento) conta.dataPagamento = dataPagamento;
        contasPagar.push(conta);
      });
      [['Vendas do balcão','Vendas',18500],['Cliente Mercadinho Bom Preço','Recebimento de Cliente',2600],['Maquininha','Cartão',9200]]
        .forEach(([origem, categoria, base], i) => {
          const venc = dia(-mes * 30 + i * 4 - 4);
          const valor = Math.round(base * (0.88 + ((mes + i) % 5) * 0.06) * 100) / 100;
          const conta = { id: `demo-receber-${mes}-${i}`, descricao: `${categoria} · ${origem}`, categoria, valor,
            dataVencimento: venc, origem, status: 'pendente', observacao: '' };
          if (mes > 0 || i === 0) { conta.status = 'recebida'; conta.dataRecebimento = venc; }
          if (mes === 2 && i === 1) { conta.status = 'recebida em atraso'; conta.dataRecebimento = dia(-mes * 30 + i * 4 + 3); }
          contasReceber.push(conta);
        });
    }
    contasPagar.push({ id: 'demo-pagar-futura', descricao: 'Fornecedor · Laticínios Serra', categoria: 'Fornecedor', valor: 2750,
      dataVencimento: dia(10), fornecedor: 'Laticínios Serra', status: 'pendente', observacao: '' });

    const registros = [];
    for (const [tipo, lista] of Object.entries({ categorias, funcionarios, vales, contasPagar, contasReceber }))
      lista.forEach(dados => registros.push({ tipo, id: dados.id, dados, versao: 1 }));

    const produtos = [
      ['Arroz Tipo 1 5kg','Mercearia',27.9,48,15,'un'], ['Feijão Carioca 1kg','Mercearia',8.49,12,20,'un'],
      ['Óleo de Soja 900ml','Mercearia',7.99,60,20,'un'], ['Café Torrado 500g','Mercearia',18.9,9,12,'un'],
      ['Leite Integral 1L','Laticínios',5.49,120,40,'un'], ['Queijo Muçarela','Laticínios',42.9,6,5,'kg'],
      ['Picanha','Açougue',79.9,14,8,'kg'], ['Frango Inteiro','Açougue',13.99,4,10,'kg'],
      ['Banana Prata','Hortifruti',6.99,35,15,'kg'], ['Tomate','Hortifruti',8.49,18,10,'kg'],
      ['Detergente 500ml','Limpeza',2.79,80,25,'un'], ['Sabão em Pó 1kg','Limpeza',14.5,7,10,'un'],
      ['Refrigerante 2L','Bebidas',9.99,72,24,'un'], ['Água Mineral 1,5L','Bebidas',2.99,90,30,'un']
    ].map(([nome, categoria, preco, estoque, minimo, unidade], i) =>
      ({ id: i + 1, nome, preco, estoque, categoria, minimo, unidade, comprar: false, versao: 1 }));

    return { registros, produtos };
  }

  function ler() {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE_DADOS) || 'null');
      if (salvo && Array.isArray(salvo.registros) && Array.isArray(salvo.produtos)) return salvo;
    } catch { /* Recomeça com os dados de demonstração. */ }
    const novo = dadosIniciais();
    gravar(novo);
    return novo;
  }
  function gravar(dados) {
    try { sessionStorage.setItem(CHAVE_DADOS, JSON.stringify(dados)); } catch { /* Continua só em memória. */ }
  }

  // ===== API simulada =====
  function responder(status, corpo) {
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
  }
  function corpoJSON(opcoes) {
    try { return opcoes?.body ? JSON.parse(opcoes.body) : {}; } catch { return {}; }
  }
  function versaoPedida(opcoes) {
    const h = opcoes?.headers || {};
    const valor = h instanceof Headers ? h.get('If-Match') : (h['If-Match'] ?? h['if-match']);
    return Number(String(valor ?? '').replace(/"/g, ''));
  }
  function produtoDe(b) {
    return { nome: String(b.nome || '').trim(), preco: Number(b.preco) || 0, estoque: Math.trunc(Number(b.estoque) || 0),
      categoria: String(b.categoria || '').trim() || 'Outros', minimo: Number(b.minimo || 0),
      unidade: String(b.unidade || '').trim() || 'un', comprar: Boolean(b.comprar) };
  }
  const desatualizado = () => responder(409, { erro: 'O registro mudou. Feche o formulário e atualize a lista.' });

  function api(caminho, metodo, opcoes) {
    const db = ler();
    const partes = caminho.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [recurso, a, b] = partes;

    if (recurso === 'gerente') {
      if (a === 'sair') {
        try { sessionStorage.removeItem(CHAVE_MODO); sessionStorage.removeItem(CHAVE_DADOS); } catch {}
        return responder(204);
      }
      if (a === 'sessao') return responder(204);
      return responder(403, { erro: 'No modo visitante não é possível alterar o acesso do gerente.' });
    }

    if (recurso === 'registros') {
      if (metodo === 'GET' && !a) return responder(200, db.registros);
      if (a === 'importar') return responder(200, { importados: 0 });
      const tipo = a;
      if (metodo === 'POST' && tipo && !b) {
        const dados = corpoJSON(opcoes);
        if (!dados.id) return responder(400, { erro: 'Confira os campos do cadastro.' });
        if (db.registros.some(r => r.tipo === tipo && r.id === dados.id)) return responder(409, { erro: 'O registro já existe. Atualize a lista.' });
        const linha = { tipo, id: dados.id, dados, versao: 1 };
        db.registros.push(linha); gravar(db);
        return responder(201, linha);
      }
      const linha = db.registros.find(r => r.tipo === tipo && r.id === b);
      if (!linha || linha.versao !== versaoPedida(opcoes)) return desatualizado();
      if (metodo === 'PUT') {
        linha.dados = corpoJSON(opcoes); linha.versao++; gravar(db);
        return responder(200, linha);
      }
      if (metodo === 'DELETE') {
        if (tipo === 'funcionarios' && db.registros.some(r => r.tipo === 'vales' && r.dados.funcionarioId === b))
          return responder(409, { erro: 'Confira o funcionário vinculado ao vale. Registros vinculados precisam ser preservados.' });
        db.registros.splice(db.registros.indexOf(linha), 1); gravar(db);
        return responder(200, linha);
      }
    }

    if (recurso === 'produtos') {
      if (metodo === 'GET' && !a) return responder(200, db.produtos);
      if (a === 'importar') return responder(200, { importado: false });
      if (metodo === 'POST' && !a) {
        const produto = { id: db.produtos.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1,
          ...produtoDe(corpoJSON(opcoes)), versao: 1 };
        if (!produto.nome) return responder(400, { erro: 'Confira o nome, preço, estoque inteiro e mínimo do produto.' });
        db.produtos.push(produto); gravar(db);
        return responder(201, { sucesso: true, produto });
      }
      const produto = db.produtos.find(p => String(p.id) === a);
      if (!produto || produto.versao !== versaoPedida(opcoes))
        return responder(409, { erro: 'O produto mudou ou foi excluído. Feche o formulário e atualize a lista.' });
      if (metodo === 'PUT') {
        Object.assign(produto, produtoDe(corpoJSON(opcoes))); produto.versao++; gravar(db);
        return responder(200, { sucesso: true, produto });
      }
      if (metodo === 'DELETE') {
        db.produtos.splice(db.produtos.indexOf(produto), 1); gravar(db);
        return responder(200, { sucesso: true, produto });
      }
    }

    if (recurso === 'teste') return responder(200, { sucesso: true, mensagem: 'Modo visitante.' });
    return responder(404, { erro: 'Rota não encontrada.' });
  }

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async function (entrada, opcoes = {}) {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return fetchOriginal(entrada, opcoes);
    const metodo = String(opcoes.method || (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase();
    await new Promise(r => setTimeout(r, 120)); // Pequena espera para as animações de carregamento aparecerem.
    return api(url.pathname, metodo, opcoes);
  };

  // ===== Aviso fixo na tela =====
  function mostrarAviso() {
    if (document.getElementById('aviso-visitante')) return;
    const estilo = document.createElement('style');
    estilo.textContent = `
      #aviso-visitante{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:10px;
        padding:8px 10px 8px 14px;border-radius:999px;background:rgba(15,23,42,.92);color:#fff;font:500 13px/1.3 system-ui,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);max-width:calc(100vw - 24px)}
      #aviso-visitante b{color:#facc15}
      #aviso-visitante button{border:0;border-radius:999px;padding:6px 12px;background:#dc2626;color:#fff;font:600 12px system-ui,sans-serif;cursor:pointer;white-space:nowrap}
      button[onclick*="cadastro-senha"]{display:none!important}
      @media (max-width:600px){#aviso-visitante{font-size:12px;bottom:10px}#aviso-visitante .detalhe{display:none}#aviso-visitante > span{white-space:nowrap}}`;
    document.head.appendChild(estilo);
    const aviso = document.createElement('div');
    aviso.id = 'aviso-visitante';
    aviso.setAttribute('role', 'note');
    aviso.innerHTML = '<span><b>Modo visitante</b> · dados de demonstração<span class="detalhe">. Alterações ficam só nesta aba.</span></span>';
    const sair = document.createElement('button');
    sair.type = 'button';
    sair.textContent = 'Sair';
    sair.onclick = () => (typeof logout === 'function' ? logout() : location.replace('../index.html'));
    aviso.appendChild(sair);
    // Fora do <body>, porque o brilho aplica um filtro nele e o filtro prende elementos fixos.
    document.documentElement.appendChild(aviso);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrarAviso);
  else mostrarAviso();
})();
