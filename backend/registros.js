const express = require('express');
const { listar, versaoEsperada } = require('./persistencia');
const rotas = express.Router();
const idValido = valor => typeof valor === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(valor);
const texto = valor => typeof valor === 'string' && valor.length <= 4000;
const preenchido = valor => texto(valor) && valor.trim().length > 0;
const dinheiro = valor => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 99999999999;
const positivo = valor => dinheiro(valor) && valor > 0;
const data = valor => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(valor + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === valor;
};
const opcional = valida => v => v === undefined || v === null || v === '' || valida(v);
const escolha = (...valores) => v => valores.includes(v);
const conta = { descricao: preenchido, categoria: opcional(texto), valor: positivo,
  dataVencimento: data, observacao: opcional(texto) };
const regras = {
  categorias: { nome: preenchido, tipo: escolha('entrada','saida') },
  funcionarios: { nome: preenchido, cpf: opcional(texto), cargo: opcional(texto), telefone: opcional(texto),
    salario: opcional(dinheiro), cargaHoraria: opcional(dinheiro), carga: opcional(dinheiro), admissao: opcional(data),
    status: opcional(escolha('ativo','inativo')) },
  vales: { funcionarioId: idValido, valor: positivo, data, motivo: opcional(texto), comprovante: opcional(texto) },
  contasPagar: { ...conta, fornecedor: opcional(texto), dataPagamento: opcional(data), arquivoConta: opcional(texto),
    comprovantePagamento: opcional(texto), status: escolha('pendente','vencida','paga','paga após vencimento','paga apos vencimento') },
  contasReceber: { ...conta, origem: opcional(texto), dataRecebimento: opcional(data),
    comprovanteRecebimento: opcional(texto), status: escolha('pendente','atrasada','recebida','recebida em atraso') }
};
function valido(tipo, dados) {
  if (!Object.hasOwn(regras,tipo) || !dados || !idValido(dados.id)) return false;
  const regra = regras[tipo];
  if (!Object.keys(dados).every(k => k === 'id' || Object.hasOwn(regra,k))) return false;
  if (!Object.entries(regra).every(([k,validar]) => validar(dados[k]))) return false;
  if (tipo === 'contasPagar' && dados.status.startsWith('paga') && !dados.dataPagamento) return false;
  if (tipo === 'contasReceber' && dados.status.startsWith('recebida') && !dados.dataRecebimento) return false;
  return true;
}
const tabela = res => res.locals.bancoGerente.from('vieira_registros');
const campos = 'tipo,id,dados,versao';
rotas.get('/', async (req, res) => res.json(await listar(() => tabela(res).select(campos).order('tipo').order('id'))));
rotas.post('/importar', async (req, res) => {
  const linhas = req.body?.linhas;
  if (!Array.isArray(linhas) || !linhas.length || linhas.length > 200 || !linhas.every(r => r && valido(r.tipo,r.dados)))
    return res.status(400).json({ erro: 'Um cadastro antigo contém campos inválidos. A cópia local foi preservada.' });
  const { data, error } = await res.locals.bancoGerente.rpc('vieira_importar', { linhas });
  if (error) throw error;
  res.json({ importados: data });
});
rotas.param('tipo', (req,res,next,tipo) => Object.hasOwn(regras,tipo) ? next() : res.sendStatus(404));
rotas.param('id', (req,res,next,id) => idValido(id) ? next() : res.sendStatus(400));
rotas.post('/:tipo', async (req, res) => {
  const tipo = req.params.tipo, dados = req.body;
  if (!valido(tipo,dados)) return res.status(400).json({ erro: 'Confira os campos do cadastro.' });
  const { data, error } = await tabela(res).insert({ tipo, id: dados.id, dados }).select(campos).single();
  if (error) throw error;
  res.status(201).json(data);
});
async function alterar(req,res,query) {
  const { data, error } = await query.eq('tipo',req.params.tipo).eq('id',req.params.id).eq('versao',res.locals.versao).select(campos).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(409).json({ erro: 'O registro foi alterado em outro dispositivo. Feche o formulário e atualize a lista.' });
  res.json(data);
}
rotas.put('/:tipo/:id', versaoEsperada, (req,res) => {
  if (!valido(req.params.tipo,req.body) || req.body.id !== req.params.id) return res.status(400).json({ erro: 'Confira os campos do cadastro.' });
  return alterar(req,res,tabela(res).update({ dados: req.body }));
});
rotas.delete('/:tipo/:id', versaoEsperada, (req,res) => alterar(req,res,tabela(res).delete()));
module.exports = rotas;
