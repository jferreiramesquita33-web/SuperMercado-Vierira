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
const values = new Map();
const context = vm.createContext({ localStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }, console, AbortController, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/storage.js'), 'utf8'), context);
values.set('sv_categorias', '{}');
assert.equal(vm.runInContext("SV.get('categorias').length", context), 0);
assert.equal(vm.runInContext("resolveStatusPagar({status:'paga após vencimento',dataVencimento:'2000-01-01'})", context), 'paga após vencimento');
const appContext = vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8'), appContext);
assert.equal(appContext.escapeHTML('<img src="x"> & "'), '&lt;img src=&quot;x&quot;&gt; &amp; &quot;');
values.set('sv_categorias', '[]'); values.set('sv_funcionarios', '[]');
vm.runInContext('initSeedData()', context);
assert.equal(values.get('sv_categorias'), '[]');
assert.equal(values.get('sv_funcionarios'), '[]');
let missing = false;
let databaseError = null;
const dbPath = require.resolve('../backend/database/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { from() {
  return { select() { return this; }, order: async () => databaseError ? ({ error: databaseError }) : ({ data: [] }), insert() { return this; }, update() { return this; }, delete() { return this; }, eq() { return this; }, single: async () => databaseError ? ({ error: databaseError }) : missing ? ({error:{code:'PGRST116'}}) : ({data:{id:1,nome:'Produto'}}) };
} } };
const app = require('../backend/server');

function mountProductPage(loadProducts) {
  const appElement = { innerHTML: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const overlay = { addEventListener() {} };
  const page = vm.createContext({
    console: { error() {} },
    document: { getElementById: id => id === 'app' ? appElement : id === 'modal-overlay' ? overlay : null },
    checkAuth() {}, initBrightness() {},
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
  const request = (url, method='GET', body) => fetch(origin + url, {method, headers: {'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  try {
    assert.equal((await request('/')).status, 200);
    assert.equal((await request('/api/produtos')).status, 200);
    for (const url of ['/backend/server.js','/backend/package.json','/backend/.env','/package.json','/tests/transitions.mjs','/api/inexistente']) assert.equal((await request(url)).status,404,url);
    for (const body of [null, {}, {nome:123,preco:1,estoque:1}, {nome:' ',preco:1,estoque:1}, {nome:'A',preco:-1,estoque:1}, {nome:'A',preco:'abc',estoque:1}, {nome:'A',preco:1,estoque:1,comprar:'false'}, {nome:'A',preco:1,estoque:1,categoria:123}]) assert.equal((await request('/api/produtos','POST',body)).status,400);
    const product = {nome:'Teste',preco:2.5,estoque:1,minimo:0,comprar:false};
    assert.equal((await request('/api/produtos','POST',product)).status,201);
    databaseError = { message: 'TypeError: fetch failed', code: '' };
    const unavailable = await request('/api/produtos');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('retry-after'), '15');
    assert.equal((await unavailable.json()).codigo, 'BANCO_INDISPONIVEL');
    assert.equal((await request('/api/produtos','POST',product)).status, 503);
    databaseError = { message: '<!DOCTYPE html><html><title>521: Web server is down</title></html>', code: '' };
    assert.equal((await request('/api/produtos')).status, 503);
    databaseError = null;
    assert.equal((await request('/api/produtos')).status, 200);

    const savedProducts = JSON.stringify([{ id: 10, nome: 'Registro salvo', preco: 3, estoque: 2 }]);
    values.set('sv_produtos', savedProducts);
    context.fetch = async () => ({ ok: false, status: 500, json: async () => ({ detalhes: 'TypeError: fetch failed' }) });
    await assert.rejects(vm.runInContext('carregarProdutos()', context), error => /temporariamente indisponível/.test(error.message));
    assert.equal(values.get('sv_produtos'), savedProducts);
    context.fetch = async () => ({ ok: false, status: 500, json: async () => ({ detalhes: '<html>521: Web server is down</html>' }) });
    await assert.rejects(vm.runInContext('carregarProdutos()', context), error => /temporariamente indisponível/.test(error.message));
    context.fetch = async () => { throw vm.runInContext("new TypeError('Failed to fetch')", context); };
    await assert.rejects(vm.runInContext('carregarProdutos()', context), error => /Verifique sua conexão/.test(error.message));
    context.fetch = async () => ({ ok: true, json: async () => [{ id: 11, nome: 'Produto remoto', preco: 4, estoque: 5 }] });
    assert.equal((await vm.runInContext('carregarProdutos()', context)).length, 1);
    assert.equal(JSON.parse(values.get('sv_produtos'))[0].id, 11);

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
    assert.equal(JSON.parse(values.get('sv_produtos'))[0].id, 11);
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
    assert.equal((await request('/api/produtos/0','PUT',product)).status,400);
    assert.equal((await request('/api/produtos/-1','DELETE')).status,400);
    missing = true;
    assert.equal((await request('/api/produtos/123','PUT',product)).status,404);
    assert.equal((await request('/api/produtos/123','DELETE')).status,404);
    assert.equal((await fetch(origin+'/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    console.log('PASS: syntax, local references, storage, product validation, missing records, invalid JSON, private file protection, unavailable database, recovery, preserved cache, immediate loading view, timeout and retry. Database mocked; no production records changed.');
  } finally { server.closeAllConnections(); server.close(); }
})().catch(err => { console.error(err); process.exitCode=1; });
