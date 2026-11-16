require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("path");
const supabase = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3000;

function responderErroBanco(res, error, mensagem) {
  const detalhes = String(error?.message || '');
  if (/fetch failed|failed to fetch|network|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|AbortError|<!doctype|<html|web server is down|service unavailable|gateway timeout/i.test(detalhes)) {
    res.set('Retry-After', '15');
    return res.status(503).json({
      erro: 'O banco de dados está temporariamente indisponível. Tente novamente em instantes.',
      codigo: 'BANCO_INDISPONIVEL'
    });
  }
  return res.status(500).json({ erro: mensagem, detalhes, codigo: error?.code });
}

app.use(express.json());

// Frontend
const frontend = path.join(__dirname, '..');
app.use('/assets', express.static(path.join(frontend, 'assets')));
app.use('/pages', express.static(path.join(frontend, 'pages')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(frontend, 'index.html')));
app.use('/api/produtos', (req, res, next) => {
  if (!supabase) return res.status(503).json({ erro: 'Configure SUPABASE_URL e SUPABASE_KEY no backend/.env.' });
  next();
});
function validateProduct(req, res, next) {
  const body = req.body;
  if (!body || typeof body.nome !== 'string' || !body.nome.trim() ||
      ['preco', 'estoque'].some(key => body[key] === undefined || body[key] === null || body[key] === '' || !['number','string'].includes(typeof body[key]) || !Number.isFinite(Number(body[key])) || Number(body[key]) < 0) ||
      (body.minimo !== undefined && (body.minimo === null || !['number','string'].includes(typeof body.minimo) || !Number.isFinite(Number(body.minimo)) || Number(body.minimo) < 0)) ||
      ['categoria', 'unidade'].some(key => body[key] != null && typeof body[key] !== 'string') ||
      (body.comprar !== undefined && typeof body.comprar !== 'boolean')) {
    return res.status(400).json({ erro: 'Informe nome e valores numéricos válidos, sem valores negativos.' });
  }
  next();
}

// =========================
// TESTE
// =========================

app.get("/api/teste", (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "API funcionando corretamente!"
  });
});

// =========================
// LISTAR PRODUTOS
// =========================

app.get("/api/produtos", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Erro Supabase ao buscar produtos:", error);

      return responderErroBanco(res, error, "Erro ao buscar produtos");
    }

    res.json(data || []);
  } catch (err) {
    console.error("Erro interno:", err);

    return responderErroBanco(res, err, "Erro interno do servidor");
  }
});

// =========================
// CADASTRAR PRODUTO
// =========================

app.post("/api/produtos", validateProduct, async (req, res) => {
  const {
    nome,
    preco,
    estoque,
    categoria,
    minimo,
    unidade,
    comprar
  } = req.body;

  if (!nome || preco === undefined || estoque === undefined) {
    return res.status(400).json({
      erro: "Nome, preço e estoque são obrigatórios"
    });
  }

  try {
    const { data, error } = await supabase
      .from("produtos")
      .insert([
        {
          nome: nome.trim(),
          preco: Number(preco) || 0,
          estoque: Number(estoque) || 0,
          categoria: categoria?.trim() || "Outros",
          minimo: Number(minimo) || 0,
          unidade: unidade?.trim() || "un",
          comprar: Boolean(comprar)
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase ao cadastrar:", error);

      return responderErroBanco(res, error, "Erro ao cadastrar produto");
    }

    res.status(201).json({
      sucesso: true,
      mensagem: "Produto cadastrado!",
      produto: data
    });
  } catch (err) {
    console.error("Erro interno:", err);

    return responderErroBanco(res, err, "Erro interno do servidor");
  }
});

// =========================
// EDITAR PRODUTO
// =========================

app.put("/api/produtos/:id", validateProduct, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      erro: "ID do produto inválido"
    });
  }

  const {
    nome,
    preco,
    estoque,
    categoria,
    minimo,
    unidade,
    comprar
  } = req.body;

  if (!nome || preco === undefined || estoque === undefined) {
    return res.status(400).json({
      erro: "Nome, preço e estoque são obrigatórios"
    });
  }

  try {
    const { data, error } = await supabase
      .from("produtos")
      .update({
        nome: nome.trim(),
        preco: Number(preco) || 0,
        estoque: Number(estoque) || 0,
        categoria: categoria?.trim() || "Outros",
        minimo: Number(minimo) || 0,
        unidade: unidade?.trim() || "un",
        comprar: Boolean(comprar)
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ erro: "Produto não encontrado" });
      console.error("Erro Supabase ao editar:", error);

      return responderErroBanco(res, error, "Erro ao editar produto");
    }

    res.json({
      sucesso: true,
      mensagem: "Produto atualizado!",
      produto: data
    });
  } catch (err) {
    console.error("Erro interno:", err);

    return responderErroBanco(res, err, "Erro interno do servidor");
  }
});

// =========================
// EXCLUIR PRODUTO
// =========================

app.delete("/api/produtos/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      erro: "ID do produto inválido"
    });
  }

  try {
    const { data, error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ erro: "Produto não encontrado" });
      console.error("Erro Supabase ao excluir:", error);

      return responderErroBanco(res, error, "Erro ao excluir produto");
    }

    res.json({
      sucesso: true,
      mensagem: "Produto excluído!",
      produto: data
    });
  } catch (err) {
    console.error("Erro interno:", err);

    return responderErroBanco(res, err, "Erro interno do servidor");
  }
});

// =========================
// SERVIDOR
// =========================

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ erro: err.status === 400 ? 'JSON inválido' : 'Erro interno do servidor' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
