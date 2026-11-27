const express = require('express');
const criarCliente = require('./database/cliente');

const rotas = express.Router();
const nomeCookie = 'viera_gerente';
const cookieFluxo = 'viera_fluxo';
const origemPublica = 'https://supermercado-vieira-docker.onrender.com';
const origensDaLoja = new Set([
  origemPublica, 'https://sistema-vieira.vercel.app', 'https://supermercado-vierira.onrender.com'
]);
const chaveVerificador = 'vieira-auth-code-verifier';

// O SDK guarda o verificador PKCE nesta requisição. Só esse valor vai ao cookie HTTP-only.
function clienteDeFluxo(req) {
  const verificador = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(cookieFluxo+'='))?.slice(cookieFluxo.length+1);
  const memoria = new Map();
  // O SDK marca os pedidos de recuperação com "/recovery", escapado no cookie.
  if (/^[a-zA-Z0-9._~-]{43,128}(?:%2Frecovery)?$/i.test(verificador || ''))
    memoria.set(chaveVerificador, JSON.stringify(decodeURIComponent(verificador)));
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
  if (res.locals.bancoGerente) {
    res.locals.tokenGerente = token;
    next();
  }
}

rotas.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
rotas.get('/sessao', exigirGerente, (req, res) => res.sendStatus(204));
rotas.post('/sair', (req, res) => res.clearCookie(cookieFluxo, opcoesCookie).clearCookie(nomeCookie, opcoesCookie).sendStatus(204));

rotas.post('/definir-senha', exigirGerente, async (req, res) => {
  const senha = req.body?.senha;
  if (typeof senha !== 'string' || [...senha].length < 12 || Buffer.byteLength(senha) > 72)
    return res.status(400).json({ erro: 'Use pelo menos 12 caracteres e até 72 bytes na senha.' });

  // O endpoint de conta do Supabase altera somente o usuário do token apresentado.
  let resposta;
  try {
    resposta = await fetch(new URL('/auth/v1/user', process.env.SUPABASE_URL), {
      method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: {
        apikey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + res.locals.tokenGerente,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: senha })
    });
  } catch { return indisponivel(res); }
  if (resposta.ok) return res.sendStatus(204);
  if (resposta.status === 429) return res.status(429).json({ erro: 'Aguarde antes de tentar cadastrar a senha novamente.' });
  if (resposta.status >= 500) return indisponivel(res);
  const detalhe = await resposta.json().catch(() => ({}));
  if (resposta.status === 401 || resposta.status === 403 || detalhe.error_code === 'reauthentication_needed')
    return res.status(401).json({ erro: 'Entre novamente por e-mail para cadastrar sua senha.' });
  if (detalhe.error_code === 'same_password') return res.status(400).json({ erro: 'Essa já é a senha da conta.' });
  return res.status(400).json({ erro: 'O serviço de acesso recusou a senha. Escolha outra senha e tente novamente.' });
});

const credenciaisInvalidas = 'E-mail ou senha incorretos.';
rotas.use((req, res, next) => {
  const permitido = emailNormalizado(process.env.VIERA_GERENTE_EMAIL);
  if (!permitido) return indisponivel(res);
  if (req.path === '/retorno') { res.locals.email = permitido; return next(); }
  const email = emailNormalizado(req.body?.email);
  if (!email || email !== permitido) {
    if (req.path === '/enviar') return res.sendStatus(204);
    return res.status(401).json({ erro: req.path === '/senha' ? credenciaisInvalidas : 'Os dados de acesso são inválidos ou expiraram.' });
  }
  res.locals.email = email;
  next();
});

rotas.post('/senha', async (req, res) => {
  const senha = req.body?.senha;
  if (typeof senha !== 'string' || !senha.length || Buffer.byteLength(senha) > 4096)
    return res.status(401).json({ erro: credenciaisInvalidas });
  const cliente = criarCliente();
  if (!cliente) return indisponivel(res);
  const email = res.locals.email;
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  return concluirSessao(res, email, data, error, credenciaisInvalidas);
});

rotas.post('/enviar', async (req, res) => {
  const { cliente, verificador } = clienteDeFluxo(req);
  if (!cliente) return indisponivel(res);
  const origem = req.get('Origin');
  const retorno = new URL('/acesso', origensDaLoja.has(origem) ? origem : origemPublica).href;
  const email = res.locals.email;
  const { error } = req.body?.recuperarSenha === true
    ? await cliente.auth.resetPasswordForEmail(email, { redirectTo: retorno })
    : await cliente.auth.signInWithOtp({ email, options: { emailRedirectTo: retorno, shouldCreateUser: false } });
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
        !['email', 'signup', 'magiclink', 'recovery'].includes(tipo) || !hash || hash.length > 256) return null;
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
  res.locals.cadastrarSenha = prova.type === 'recovery';
  return concluirSessao(res,email,data,error);
});

rotas.post('/retorno', async (req,res) => {
  const autorizacao = req.get('Authorization');
  if (autorizacao !== undefined) {
    // Links emitidos fora do fluxo PKCE podem retornar uma sessão no fragmento.
    // O servidor confirma a identidade no Supabase antes de criar o cookie da loja.
    const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(autorizacao)?.[1];
    if (!token || token.length > 3900 || req.body?.codigo)
      return res.status(400).json({ erro: 'O link está incompleto. Solicite uma nova mensagem pelo Viera.' });
    const cliente = criarCliente();
    if (!cliente) return indisponivel(res);
    const { data, error } = await cliente.auth.getUser(token);
    if (error) return concluirSessao(res, res.locals.email, null, error);
    // O token já foi validado pelo emissor. O cookie também termina no vencimento dele.
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const restante = exp - Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(restante) || restante <= 0)
      return res.status(401).json({ erro: 'O link expirou. Solicite uma nova mensagem pelo Viera.' });
    res.locals.cadastrarSenha = req.body?.recuperarSenha === true;
    return concluirSessao(res, res.locals.email, { user: data.user, session: { access_token: token, expires_in: restante } });
  }
  const codigo = req.body?.codigo;
  if (typeof codigo !== 'string' || !/^[a-zA-Z0-9_-]{16,180}$/.test(codigo))
    return res.status(400).json({erro:'O link recebido está incompleto.'});
  const { cliente, verificador } = clienteDeFluxo(req);
  if (!cliente) return indisponivel(res);
  if (!verificador()) return res.status(400).json({erro:'Abra o link no mesmo navegador e endereço em que pediu o acesso.'});
  const {data,error} = await cliente.auth.exchangeCodeForSession(codigo);
  res.locals.cadastrarSenha = data?.redirectType === 'recovery';
  return concluirSessao(res,res.locals.email,data,error);
});

async function concluirSessao(res,email,data,error, erroCredencial = 'O acesso expirou ou já foi usado. Solicite outro e-mail.') {
  if (error) {
    if (error.status === 429) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    if (!error.status || error.status >= 500) return indisponivel(res);
    return res.status(401).json({ erro: erroCredencial });
  }
  if (!data?.session?.access_token || !data.user?.email_confirmed_at || emailNormalizado(data.user.email) !== email) {
    return res.status(403).json({ erro: 'A confirmação precisa ser feita com o e-mail do gerente.' });
  }
  if (!await bancoAutorizado(data.session.access_token, res)) return;
  if (res.locals.cadastrarSenha) res.set('X-Viera-Proximo-Passo', 'cadastrar-senha');
  res.cookie(nomeCookie, data.session.access_token, {
    ...opcoesCookie, maxAge: Math.min(data.session.expires_in || 3600, 3600) * 1000
  }).clearCookie(cookieFluxo, opcoesCookie).sendStatus(204);
}

module.exports = { rotas, exigirGerente };
