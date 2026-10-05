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
const context = vm.createContext({ localStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }, console });
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
const dbPath = require.resolve('../backend/database/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { from() {
  return { select() { return this; }, order: async () => ({ data: [] }), insert() { return this; }, update() { return this; }, delete() { return this; }, eq() { return this; }, single: async () => missing ? ({error:{code:'PGRST116'}}) : ({data:{id:1,nome:'Produto'}}) };
} } };
const app = require('../backend/server');
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
    assert.equal((await request('/api/produtos/0','PUT',product)).status,400);
    assert.equal((await request('/api/produtos/-1','DELETE')).status,400);
    missing = true;
    assert.equal((await request('/api/produtos/123','PUT',product)).status,404);
    assert.equal((await request('/api/produtos/123','DELETE')).status,404);
    assert.equal((await fetch(origin+'/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    console.log('PASS: syntax, local references, storage, product validation, missing records, invalid JSON and private file protection. Database mocked; no production records changed.');
  } finally { server.closeAllConnections(); server.close(); }
})().catch(err => { console.error(err); process.exitCode=1; });
