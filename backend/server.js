require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { rotas: acesso, exigirGerente } = require('./gerente');
const registros = require('./registros');
const { listar, erroBanco, versaoEsperada } = require('./persistencia');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" });
  next();
});
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('Sec-Fetch-Site') === 'cross-site')
    return res.status(403).json({ erro: 'Origem da solicitação recusada.' });
  next();
});
app.use(express.json({ limit: '256kb' }));
app.use('/api/gerente', acesso);
app.get('/api/teste', (req, res) => res.json({ sucesso: true, mensagem: 'API funcionando corretamente!' }));
app.use('/api/registros', exigirGerente, registros);

const raiz = path.join(__dirname, '..');
app.use('/assets', express.static(path.join(raiz, 'assets')));
app.use('/pages', express.static(path.join(raiz, 'pages')));
app.get(['/', '/acesso', '/recuperar-senha', '/index.html', '/index.htm'], (req, res) => {
  res.set({ 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' });
  res.sendFile(path.join(raiz, 'index.html'));
});

app.use('/api/produtos', exigirGerente);
const tabela = res => res.locals.bancoGerente.from('produtos');
const campos = 'id,nome,preco,estoque,categoria,minimo,unidade,comprar,versao';
function produtoValido(req, res, next) {
  const b = req.body || {};
  const numero = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) &&
    Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 2147483647;
  if (typeof b.nome !== 'string' || !b.nome.trim() || b.nome.length > 200 ||
      !numero(b.preco) || !numero(b.estoque) || !Number.isInteger(Number(b.estoque)) ||
      (b.minimo !== undefined && !numero(b.minimo)) ||
      ['categoria','unidade'].some(k => b[k] != null && (typeof b[k] !== 'string' || b[k].length > 120)) ||
      (b.comprar !== undefined && typeof b.comprar !== 'boolean')) {
    return res.status(400).json({ erro: 'Confira o nome, preço, estoque inteiro e mínimo do produto.' });
  }
  res.locals.produto = { nome: b.nome.trim(), preco: Number(b.preco), estoque: Number(b.estoque),
    categoria: b.categoria?.trim() || 'Outros', minimo: Number(b.minimo || 0),
    unidade: b.unidade?.trim() || 'un', comprar: b.comprar || false };
  next();
}
app.param('id', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return res.status(400).json({ erro: 'ID inválido.' });
  next();
});
app.get('/api/produtos', async (req, res) => {
  const rows = await listar(() => tabela(res).select(campos).order('id'));
  res.json(rows);
});
app.post('/api/produtos/importar', produtoValido, async (req,res) => {
  const id = req.body.id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || /^\d+$/.test(id))
    return res.status(400).json({erro:'Identificador do produto antigo inválido.'});
  const {data,error} = await res.locals.bancoGerente.rpc('vieira_importar_produto', {id_local:id, produto:res.locals.produto});
  if (error) throw error;
  res.json({importado:data});
});
app.post('/api/produtos', produtoValido, async (req, res) => {
  const chave = req.get('Idempotency-Key');
  if (chave && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(chave))
    return res.status(400).json({ erro: 'Identificador de cadastro inválido.' });
  const produto = res.locals.produto;
  const { data, error } = await tabela(res).insert(chave ? { ...produto, chave_cadastro: chave } : produto).select(campos).single();
  if (chave && error?.code === '23505') {
    const anterior = await tabela(res).select(campos).eq('chave_cadastro', chave).maybeSingle();
    if (anterior.error) throw anterior.error;
    if (anterior.data && Object.keys(produto).every(k => anterior.data[k] === produto[k]))
      return res.json({ sucesso: true, produto: anterior.data });
    return res.status(409).json({ erro: 'O cadastro anterior já foi gravado. Confira a lista antes de editar.' });
  }
  if (error) throw error;
  res.status(201).json({ sucesso: true, produto: data });
});
async function confirmarAlteracao(req, res, query) {
  const { data, error } = await query.eq('id', req.params.id).eq('versao', res.locals.versao).select(campos).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(409).json({ erro: 'O produto mudou ou foi excluído em outro dispositivo. Feche o formulário e atualize a lista.' });
  res.json({ sucesso: true, produto: data });
}
app.put('/api/produtos/:id', versaoEsperada, produtoValido, (req, res) =>
  confirmarAlteracao(req, res, tabela(res).update(res.locals.produto)));
app.delete('/api/produtos/:id', versaoEsperada, (req, res) =>
  confirmarAlteracao(req, res, tabela(res).delete()));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Envie menos registros por vez.' });
  return erroBanco(res, err);
});
if (require.main === module) app.listen(process.env.PORT || 3000);
module.exports = app;
