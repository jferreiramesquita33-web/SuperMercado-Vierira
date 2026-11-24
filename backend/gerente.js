const express = require('express');
const criarCliente = require('./database/cliente');

const rotas = express.Router();
const nomeCookie = 'viera_gerente';
const cookieFluxo = 'viera_fluxo';
const urlPublica = 'https://supermercado-vieira-docker.onrender.com/';
const origensDaLoja = new Set([
  new URL(urlPublica).origin, 'https://sistema-vieira.vercel.app', 'https://supermercado-vierira.onrender.com'
]);
const chaveVerificador = 'vieira-auth-code-verifier';

// O SDK guarda o verificador PKCE nesta requisição. Só esse valor vai ao cookie HTTP-only.
function clienteDeFluxo(req) {
  const verificador = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(cookieFluxo+'='))?.slice(cookieFluxo.length+1);
  const memoria = new Map();
  if (/^[a-zA-Z0-9._~-]{43,128}$/.test(verificador || '')) memoria.set(chaveVerificador, JSON.stringify(verificador));
  const storage = {
    getItem: k => memoria.get(k) ?? null, setItem: (k,v) => memoria.set(k,v), removeItem: k => memoria.delete(k)
  };
  const cliente = criarCliente(null, { flowType:'pkce', persistSession:true, storageKey:'vieira-auth', storage });
  return { cliente, verificador:() => JSON.parse(memoria.get(chaveVerificador) || 'null') };
}
const opcoesCookie = {
  httpOnly: true,
  secure: Boolean(process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production'),
  sameSite: 'strict',
  path: '/api'
};

function emailNormalizado(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

function semSessao(res) {
  return res.status(401).json({ codigo: 'GERENTE_NECESSARIO', erro: 'Confirme o e-mail de gerente para acessar o sistema.' });
}

function indisponivel(res) {
  return res.status(503).json({ erro: 'O acesso do gerente está temporariamente indisponível.' });
}

async function bancoAutorizado(token, res) {
  const cliente = criarCliente(token);
  if (!cliente) { indisponivel(res); return; }
  const { data, error, status } = await cliente.rpc('vieira_e_gerente');
  if (error) {
    if (status === 401) semSessao(res);
    else if (status === 403) res.status(403).json({ erro: 'Esta conta não tem permissão de gerente.' });
    else indisponivel(res);
    return;
  }
  if (data !== true) {
    res.status(403).json({ erro: 'Esta conta não tem permissão de gerente.' });
    return;
  }
  return cliente;
}

async function exigirGerente(req, res, next) {
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(nomeCookie + '='));
  const bearer = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
  const token = bearer?.[1] || cookie?.slice(nomeCookie.length + 1);
  if (!token) return semSessao(res);
  res.locals.bancoGerente = await bancoAutorizado(token, res);
  if (res.locals.bancoGerente) next();
}

rotas.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
rotas.get('/sessao', exigirGerente, (req, res) => res.sendStatus(204));
rotas.post('/sair', (req, res) => res.clearCookie(cookieFluxo, opcoesCookie).clearCookie(nomeCookie, opcoesCookie).sendStatus(204));

rotas.use((req, res, next) => {
  const permitido = emailNormalizado(process.env.VIERA_GERENTE_EMAIL);
  if (!permitido) return indisponivel(res);
  if (req.path === '/retorno') { res.locals.email = permitido; return next(); }
  const email = emailNormalizado(req.body?.email);
  if (!email || email !== permitido) {
    if (req.path === '/enviar') return res.sendStatus(204);
    return res.status(401).json({ erro: 'Os dados de acesso são inválidos ou expiraram.' });
  }
  res.locals.email = email;
  next();
});

rotas.post('/enviar', async (req, res) => {
  const { cliente, verificador } = clienteDeFluxo(req);
  if (!cliente) return indisponivel(res);
  const origem = req.get('Origin');
  const retorno = origensDaLoja.has(origem) ? origem + '/' : urlPublica;
  const { error } = await cliente.auth.signInWithOtp({
    email: res.locals.email, options: { emailRedirectTo: retorno, shouldCreateUser: false }
  });
  if (error) {
    if (error.status === 429) return res.status(429).json({ erro: 'Aguarde antes de pedir outro e-mail.' });
    return res.status(503).json({ erro: 'O serviço de e-mail não conseguiu enviar o acesso. Tente novamente em instantes.' });
  }
  const valor = verificador();
  if (!valor) return indisponivel(res);
  res.cookie(cookieFluxo, valor, { ...opcoesCookie, maxAge:3600000 }).sendStatus(204);
});

// O modelo padrão do Supabase envia um link. Modelos personalizados podem enviar um código.
function dadosVerificacao(email, comprovante) {
  if (typeof comprovante !== 'string' || comprovante.length > 4096) return null;
  const valor = comprovante.trim();
  if (/^\d{6,10}$/.test(valor)) return { email, token: valor, type: 'email' };
  try {
    const link = new URL(valor);
    const tipo = link.searchParams.get('type');
    const hash = link.searchParams.get('token');
    if (link.origin !== new URL(process.env.SUPABASE_URL).origin || link.pathname !== '/auth/v1/verify' ||
        !['email', 'signup', 'magiclink'].includes(tipo) || !hash || hash.length > 256) return null;
    return { token_hash: hash, type: tipo };
  } catch { return null; }
}

rotas.post('/confirmar', async (req, res) => {
  const cliente = criarCliente();
  if (!cliente) return indisponivel(res);
  const email = res.locals.email;
  const prova = dadosVerificacao(email, req.body?.comprovante);
  if (!prova) return res.status(400).json({ erro: 'Cole o link original do e-mail ou digite o código recebido.' });
  const { data, error } = await cliente.auth.verifyOtp(prova);
  return concluirSessao(res,email,data,error);
});

rotas.post('/retorno', async (req,res) => {
  const codigo = req.body?.codigo;
  if (typeof codigo !== 'string' || !/^[a-zA-Z0-9_-]{16,180}$/.test(codigo))
    return res.status(400).json({erro:'O link recebido está incompleto.'});
  const { cliente, verificador } = clienteDeFluxo(req);
  if (!cliente) return indisponivel(res);
  if (!verificador()) return res.status(400).json({erro:'Abra o link no mesmo navegador e endereço em que pediu o acesso.'});
  const {data,error} = await cliente.auth.exchangeCodeForSession(codigo);
  return concluirSessao(res,res.locals.email,data,error);
});

async function concluirSessao(res,email,data,error) {
  if (error) {
    if (error.status === 429) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    if (!error.status || error.status >= 500) return indisponivel(res);
    return res.status(401).json({ erro: 'O acesso expirou ou já foi usado. Solicite outro e-mail.' });
  }
  if (!data.session?.access_token || !data.user?.email_confirmed_at || emailNormalizado(data.user.email) !== email) {
    return res.status(403).json({ erro: 'A confirmação precisa ser feita com o e-mail do gerente.' });
  }
  if (!await bancoAutorizado(data.session.access_token, res)) return;
  res.cookie(nomeCookie, data.session.access_token, {
    ...opcoesCookie, maxAge: Math.min(data.session.expires_in || 3600, 3600) * 1000
  }).clearCookie(cookieFluxo, opcoesCookie).sendStatus(204);
}

module.exports = { rotas, exigirGerente };
