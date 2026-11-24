const express = require('express');
const criarCliente = require('./database/cliente');

const rotas = express.Router();
const nomeCookie = 'viera_gerente';
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
rotas.post('/sair', (req, res) => res.clearCookie(nomeCookie, opcoesCookie).sendStatus(204));

rotas.use((req, res, next) => {
  const permitido = emailNormalizado(process.env.VIERA_GERENTE_EMAIL);
  if (!permitido) return indisponivel(res);
  const email = emailNormalizado(req.body?.email);
  if (!email || email !== permitido) {
    if (req.path === '/enviar') return res.sendStatus(204);
    return res.status(401).json({ erro: 'Os dados de acesso são inválidos ou expiraram.' });
  }
  res.locals.email = email;
  next();
});

rotas.post('/enviar', async (req, res) => {
  const cliente = criarCliente();
  if (!cliente) return indisponivel(res);
  const { error } = await cliente.auth.signInWithOtp({ email: res.locals.email });
  if (error) {
    if (error.status === 429) return res.status(429).json({ erro: 'Aguarde antes de pedir outro e-mail.' });
    return res.status(503).json({ erro: 'O serviço de e-mail não conseguiu enviar o acesso. Tente novamente em instantes.' });
  }
  res.sendStatus(204);
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
  }).sendStatus(204);
});

module.exports = { rotas, exigirGerente };
