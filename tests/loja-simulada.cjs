// Simula apenas a fronteira com o Supabase. Rotas, cookies, validações e páginas são os reais.
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const estado = { produtos: [], vieira_registros: [], importados: new Set(), sessoes: new Set(), identidades: new Map(), erro: null };
let proximoId = 1;
function consulta(tabela) {
  const linhas = estado[tabela];
  let operacao = 'ler', corpo;
  const filtros = [];
  function executar() {
    if (estado.erro) return { error:estado.erro };
    const registros = linhas.filter(row => filtros.every(([k,v]) => String(row[k]) === String(v)));
    if (operacao === 'incluir') {
      if (linhas.some(r => tabela === 'produtos' ? corpo.chave_cadastro && r.chave_cadastro === corpo.chave_cadastro : r.tipo === corpo.tipo && r.id === corpo.id))
        return { error:{ code:'23505' } };
      const row = { ...corpo, versao:1, id:corpo.id || proximoId++ };
      linhas.push(row); return { data:[row] };
    }
    if (operacao === 'editar') registros.forEach(r => Object.assign(r,corpo,{versao:r.versao+1}));
    if (operacao === 'excluir') registros.forEach(r => linhas.splice(linhas.indexOf(r),1));
    return { data:registros };
  }
  return {
    select() { return this; }, order() { return this; },
    eq(k,v) { filtros.push([k,v]); return this; },
    insert(dados) { operacao='incluir'; corpo=dados; return this; },
    update(dados) { operacao='editar'; corpo=dados; return this; },
    delete() { operacao='excluir'; return this; },
    async range(inicio,fim) { const r=executar(); return r.error ? r : {data:r.data.slice(inicio,fim+1)}; },
    async single() { return this.maybeSingle(); },
    async maybeSingle() { const r=executar(); return r.error ? r : {data:r.data[0] || null}; }
  };
}
process.env.VIERA_GERENTE_EMAIL = 'gerente@example.test';
process.env.SUPABASE_URL = 'https://viera.example';
process.env.SUPABASE_KEY = 'chave-publicavel-de-teste';
const fetchReal = global.fetch;
global.fetch = async (url, opcoes) => {
  if (String(url) !== 'https://viera.example/auth/v1/user') return fetchReal(url, opcoes);
  assert.equal(opcoes.method, 'PUT');
  assert.equal(opcoes.headers.apikey, process.env.SUPABASE_KEY);
  const token = opcoes.headers.Authorization.replace(/^Bearer /, '');
  if (!estado.sessoes.has(token)) return Response.json({}, {status:401});
  estado.senha = JSON.parse(opcoes.body).password;
  return Response.json({});
};
function sessaoDeTeste() {
  const exp = Math.floor(Date.now() / 1000) + 1800;
  const carga = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const access_token = ['teste', carga, randomUUID()].join('.');
  const user = { email: 'gerente@example.test', email_confirmed_at: '2026-01-01' };
  estado.sessoes.add(access_token);
  estado.identidades.set(access_token, user);
  return {data:{user, session:{access_token,expires_in:1800}}};
}
function cliente(token, auth = {}) {
  if (!token) return { auth: {
    async signInWithOtp(opcoes) {
      estado.ultimoEnvio=opcoes;
      if (estado.falhaEmail) return {error:{status:estado.falhaEmail}};
      auth.storage.setItem('vieira-auth-code-verifier', JSON.stringify('v'.repeat(64)));
      return {};
    },
    async resetPasswordForEmail(email, opcoes) {
      estado.ultimaRecuperacao = { email, ...opcoes };
      if (estado.falhaEmail) return {error:{status:estado.falhaEmail}};
      assert.equal(auth.flowType, 'implicit');
      return {};
    },
    async exchangeCodeForSession(codigo) {
      const recuperar = codigo === 'codigo-de-recuperacao-valido';
      const verificador = 'v'.repeat(64) + (recuperar ? '/recovery' : '');
      if ((!recuperar && codigo !== 'codigo-de-teste-valido') || auth.storage.getItem('vieira-auth-code-verifier') !== JSON.stringify(verificador))
        return { error:{status:400} };
      const resposta = sessaoDeTeste();
      resposta.data.redirectType = recuperar ? 'recovery' : null;
      return resposta;
    },
    async getUser(token) {
      const user = estado.identidades.get(token);
      return user ? { data: { user } } : { data: { user: null }, error: { status: 401 } };
    },
    async verifyOtp(prova) {
      estado.ultimaProva=prova;
      if (prova.token !== '123456' && prova.token_hash !== 'hash-de-teste') return { error:{status:403} };
      return sessaoDeTeste();
    },
    async signInWithPassword({email,password}) {
      if (email !== process.env.VIERA_GERENTE_EMAIL || !estado.senha || password !== estado.senha) return {error:{status:400}};
      return sessaoDeTeste();
    }
  }};
  return {
    from(tabela) { assert.ok(estado.sessoes.has(token)); return consulta(tabela); },
    async rpc(nome, args) {
      if (nome === 'vieira_e_gerente') {
        if (token === 'expirada') return {error:{},status:401};
        return { data:estado.sessoes.has(token) };
      }
      assert.ok(estado.sessoes.has(token));
      assert.equal(nome,'vieira_importar');
      let importados = 0;
      for (const {tipo,dados} of args.linhas) {
        const chave = tipo + '/' + dados.id;
        if (estado.importados.has(chave)) continue;
        estado.importados.add(chave);
        const r = await consulta('vieira_registros').insert({tipo,id:dados.id,dados}).single();
        if (!r.error) importados++;
      }
      return {data:importados};
    }
  };
}
const id = require.resolve('../backend/database/cliente');
require.cache[id] = { id, filename:id, loaded:true, exports:cliente };
module.exports = estado;
