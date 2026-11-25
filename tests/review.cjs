const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'assets/js'))) {
  if (name.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, 'assets/js', name), 'utf8'), { filename: name });
}
for (const name of ['index.html', ...fs.readdirSync(path.join(root, 'pages')).map(n => 'pages/' + n)]) {
  const html = fs.readFileSync(path.join(root, name), 'utf8');
  assert.ok(!html.startsWith('```'), name + ': markdown outside HTML');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/.test(match[1])) new vm.Script(match[2], { filename: name });
  }
  for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[^\"]*)"/g)) {
    if (/^(https?:|data:|#)/.test(match[1])) continue;
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(name), match[1])), name + ': missing ' + match[1]);
  }
}
const context = vm.createContext({ document:{addEventListener(){}}, window:{addEventListener(){}}, console, AbortController, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(path.join(root,'assets/js/storage.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'assets/js/historico.js'),'utf8'),context);
const appContext = vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8'),appContext);
assert.equal(appContext.escapeHTML('<>&'), '&lt;&gt;&amp;');
const estado = require('./loja-simulada.cjs');
const app = require('../backend/server');

function mountProductPage(loadProducts) {
  const appElement = { innerHTML: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const overlay = { addEventListener() {} };
  const page = vm.createContext({
    console: { error() {} },
    document: { getElementById: id => id === 'app' ? appElement : id === 'modal-overlay' ? overlay : null },
    iniciarPagina(callback) { callback(); }, initBrightness() {},
    carregarProdutos: loadProducts,
    renderSidebar: () => '<aside>Menu de gestão</aside>',
    topbar: () => '<header>Produtos</header>',
    escapeHTML: appContext.escapeHTML
  });
  const html = fs.readFileSync(path.join(root, 'pages/produtos.html'), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/.test(match[1])) vm.runInContext(match[2], page);
  }
  return { appElement, page };
}

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const request = (url, method='GET', body, headers={}) => fetch(origin + url, {method, headers: {'Content-Type':'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
  try {
    assert.equal((await request('/')).status, 200);
    for (const url of ['/backend/server.js','/backend/.env','/package.json','/api/inexistente']) assert.equal((await request(url)).status,404,url);
    const email = 'gerente@example.test';
    for (const path of ['/api/produtos','/api/registros','/api/gerente/sessao'])
      assert.equal((await request(path)).status,401,path);
    const product = {nome:'Refrigerante 2 L',preco:8.75,estoque:12,minimo:2,unidade:'un',categoria:'Bebidas',comprar:false};
    assert.equal((await request('/api/produtos','POST',product)).status,401);
    assert.equal((await request('/api/gerente/enviar','POST',{email:'outra@example.test'})).status,204);
    assert.equal(estado.ultimoEnvio,undefined);
    const inicio = await request('/api/gerente/enviar','POST',{email});
    assert.equal(inicio.status,204);
    assert.equal(estado.ultimoEnvio.email,email);
    assert.equal(estado.ultimoEnvio.options.emailRedirectTo,'https://supermercado-vieira-docker.onrender.com/');
    const fluxo = inicio.headers.getSetCookie()[0].split(';')[0];
    const codigo = { codigo:'codigo-de-teste-valido' };
    assert.equal((await request('/api/gerente/retorno','POST',codigo)).status,400);
    const retorno = await request('/api/gerente/retorno','POST',codigo,{Cookie:fluxo});
    assert.equal(retorno.status,204);
    assert.ok(retorno.headers.getSetCookie().some(c => c.startsWith('viera_gerente=') && c.includes('HttpOnly')));
    const acesso = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/auth.js'),'utf8'),acesso);
    for (const [status,body] of [[404,'The page could not be found'],[200,'<html>'],[429,'Limite']]) {
      acesso.fetch=async()=>new Response(body,{status});
      await assert.rejects(acesso.requisitarAcesso('enviar',{email}), err=>err.status===status && !err.message.includes('JSON'));
    }
    assert.equal((await request('/api/gerente/confirmar','POST',{email,comprovante:'123456'})).status,404);
    const cookie = retorno.headers.getSetCookie()[0];
    assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Strict/); assert.match(cookie,/Path=\/api/);
    const a = { Cookie:cookie.split(';')[0] };
    const novoInicio = await request('/api/gerente/enviar','POST',{email});
    const novoFluxo = novoInicio.headers.getSetCookie()[0].split(';')[0];
    const novaSessao = await request('/api/gerente/retorno','POST',codigo,{Cookie:novoFluxo});
    const b = {Cookie:novaSessao.headers.getSetCookie()[0].split(';')[0]};
    assert.notEqual(a.Cookie,b.Cookie);
    const api = (url,method,body,headers=a) => request(url,method,body,headers);
    for (const body of [null,{}, {...product,nome:' '},{...product,estoque:1.2},{...product,preco:-1},{...product,comprar:'false'},{...product,categoria:123}])
      assert.equal((await api('/api/produtos','POST',body)).status,400);
    const key = {...a,'Idempotency-Key':require('node:crypto').randomUUID()};
    assert.equal((await api('/api/produtos','POST',product,key)).status,201);
    assert.equal((await api('/api/produtos','POST',product,key)).status,200);
    const [item] = await (await api('/api/produtos','GET',undefined,b)).json();
    assert.equal(item.nome,product.nome);
    assert.equal(estado.produtos.length,1);
    assert.equal((await api('/api/produtos/1','PUT',product)).status,428);
    assert.equal((await api('/api/produtos/1','PUT',{...product,estoque:9},{...b,'If-Match':'1'})).status,200);
    assert.equal((await api('/api/produtos/1','PUT',product,{...a,'If-Match':'1'})).status,409);
    assert.equal((await api('/api/produtos/1','DELETE',undefined,{...a,'If-Match':'2'})).status,200);
    assert.equal((await api('/api/produtos/1','DELETE',undefined,{Authorization:'Bearer expirada'})).status,401);
    assert.equal((await api('/api/registros','GET',undefined,{Authorization:'Bearer sem-perfil'})).status,403);
    const conta = {id:'conta-a',descricao:'Bebidas',valor:29.90,dataVencimento:'2026-11-20',status:'pendente'};
    const rota='/api/registros/contasPagar';
    assert.equal((await api(rota,'POST',{...conta,dataVencimento:'2026-02-30'})).status,400);
    assert.equal((await api(rota,'POST',conta)).status,201);
    const registros = await (await api('/api/registros','GET',undefined,b)).json();
    assert.equal(registros[0].dados.valor,29.90);
    assert.equal((await api(rota+'/conta-a','PUT',{...conta,valor:30},{...b,'If-Match':'1'})).status,200);
    assert.equal((await api(rota+'/conta-a','DELETE',undefined,{...a,'If-Match':'1'})).status,409);
    const lote = {linhas:[{tipo:'contasPagar',dados:{...conta,id:'antigo'}}]};
    for(const qtd of [1,0]) assert.equal((await (await api('/api/registros/importar','POST',lote)).json()).importados,qtd);
    await api(rota+'/antigo','DELETE',undefined,{...a,'If-Match':'1'});
    assert.equal((await (await api('/api/registros/importar','POST',lote)).json()).importados,0);
    estado.erro={message:'fetch failed'};
    const indisponivel = await api('/api/produtos');
    assert.equal(indisponivel.status,503); assert.equal(indisponivel.headers.get('retry-after'),'15');
    estado.erro=null;
    assert.equal((await api('/api/produtos')).status,200);
    const saiu = await api('/api/gerente/sair','POST');
    assert.match(saiu.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
    const datas = vm.runInContext(`historicoSemestral([
      {valor:1.23,dataVencimento:'2025-12-01',status:'pendente'},
      {valor:2.34,dataVencimento:'2026-01-31',status:'paga',dataPagamento:'2026-02-01'},
      {valor:1,dataVencimento:'2025-08-31',status:'pendente'}], [], 'abertas',new Date(2026,1,28))`,context);
    assert.equal(datas.length,6);assert.equal(datas[3].pagar,123);assert.equal(datas[4].pagar,0);
    let abortPending;
    let clearedTimeout = false;
    context.setTimeout = (callback, milliseconds) => { assert.equal(milliseconds, 15000); abortPending = callback; return 123; };
    context.clearTimeout = id => { assert.equal(id, 123); clearedTimeout = true; };
    context.fetch = (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => { const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); });
    });
    const timedRequest = vm.runInContext('carregarProdutos()', context);
    abortPending();
    await assert.rejects(timedRequest, error => /demorou demais/.test(error.message));
    assert.equal(clearedTimeout, true);

    context.setTimeout = setTimeout;
    context.clearTimeout = clearTimeout;

    let resolveProducts;
    let loadCalls = 0;
    const slowProducts = new Promise(resolve => { resolveProducts = resolve; });
    const pendingPage = mountProductPage(() => { loadCalls++; return slowProducts; });
    assert.match(pendingPage.appElement.innerHTML, /Carregando produtos/);
    assert.match(pendingPage.appElement.innerHTML, /Menu de gestão/);
    assert.equal(pendingPage.appElement.attributes['aria-busy'], 'true');
    await vm.runInContext('carregarPaginaProdutos()', pendingPage.page);
    assert.equal(loadCalls, 1);
    resolveProducts([{ id: 1, nome: 'Arroz de teste', preco: 10, estoque: 5, minimo: 1 }]);
    await new Promise(setImmediate);
    assert.match(pendingPage.appElement.innerHTML, /Arroz de teste/);
    assert.equal(pendingPage.appElement.attributes['aria-busy'], 'false');

    let shouldFail = true;
    const retryPage = mountProductPage(async () => { if (shouldFail) throw new Error('Consulta indisponível'); return []; });
    await new Promise(setImmediate);
    assert.match(retryPage.appElement.innerHTML, /Tentar novamente/);
    assert.match(retryPage.appElement.innerHTML, /Consulta indisponível/);
    shouldFail = false;
    await vm.runInContext('carregarPaginaProdutos()', retryPage.page);
    assert.match(retryPage.appElement.innerHTML, /Lista de Produtos do Supermercado/);
    assert.equal(retryPage.appElement.attributes['aria-busy'], 'false');
    const tentativas = [];
    const navegador = vm.createContext({ fetch: async (url, opcoes) => {
      tentativas.push([url,opcoes]);
      return tentativas.length === 1 ? Response.json({codigo:'GERENTE_NECESSARIO'},{status:401}) : Response.json({sucesso:true});
    } });
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/gerente-produtos.js'),'utf8'), navegador);
    vm.runInContext('confirmarGerente = async () => true', navegador);
    assert.equal((await vm.runInContext("alterarComoGerente('/api/produtos/1',{method:'PUT',body:'dados'})", navegador)).status,200);
    assert.equal(tentativas.length,2);
    assert.deepEqual(tentativas[0],tentativas[1]);
    tentativas.length = 0;
    vm.runInContext('confirmarGerente = async () => false', navegador);
    await assert.rejects(vm.runInContext("alterarComoGerente('/api/produtos/1',{method:'DELETE'})", navegador), /cancelada/);
    assert.equal(tentativas.length,1);
    assert.equal((await fetch(origin+'/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    console.log('PASS: sessão, validação, cadastro compartilhado, repetição segura, conflitos, importação, gráfico, indisponibilidade, timeout e recuperação.');
  } finally { server.closeAllConnections(); server.close(); }
})().catch(err => { console.error(err); process.exitCode=1; });
