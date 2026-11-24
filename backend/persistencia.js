async function listar(consulta) {
  const linhas = [];
  const tamanho = 200;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await consulta().range(inicio, inicio + tamanho - 1);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < tamanho) return linhas;
  }
}
function versaoEsperada(req, res, next) {
  const versao = Number(req.get('If-Match')?.replace(/^"(\d+)"$/, '$1'));
  if (!Number.isSafeInteger(versao) || versao < 1) return res.status(428).json({ erro: 'Atualize a página antes de continuar.' });
  res.locals.versao = versao;
  next();
}
function erroBanco(res, err) {
  if (err.code === '23503') return res.status(409).json({ erro: 'Confira o funcionário vinculado ao vale. Registros vinculados precisam ser preservados.' });
  if (err.code === '23505') return res.status(409).json({ erro: 'O registro já existe. Atualize a lista.' });
  if (err.code === '42501') return res.status(403).json({ erro: 'Permissão insuficiente para esta operação.' });
  if (/fetch failed|failed to fetch|network|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|AbortError|<!doctype|<html|service unavailable|gateway timeout/i.test(err.message || ''))
    return res.set('Retry-After','15').status(503).json({ codigo: 'BANCO_INDISPONIVEL', erro: 'O banco de dados está temporariamente indisponível. Tente novamente em instantes.' });
  console.error('Falha de persistência', err.code || 'indisponível');
  return res.status(500).json({ erro: 'Não foi possível concluir a operação no banco.' });
}
module.exports = { listar, erroBanco, versaoEsperada };
