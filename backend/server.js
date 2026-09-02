require("dotenv").config();

const express = require("express");
const path = require("path");
const supabase = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Frontend
app.use(express.static(path.join(__dirname, "..")));

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

      return res.status(500).json({
        erro: "Erro ao buscar produtos",
        detalhes: error.message,
        codigo: error.code
      });
    }

    res.json(data || []);
  } catch (err) {
    console.error("Erro interno:", err);

    res.status(500).json({
      erro: "Erro interno do servidor",
      detalhes: err.message
    });
  }
});

// =========================
// CADASTRAR PRODUTO
// =========================

app.post("/api/produtos", async (req, res) => {
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

      return res.status(500).json({
        erro: "Erro ao cadastrar produto",
        detalhes: error.message,
        codigo: error.code
      });
    }

    res.status(201).json({
      sucesso: true,
      mensagem: "Produto cadastrado!",
      produto: data
    });
  } catch (err) {
    console.error("Erro interno:", err);

    res.status(500).json({
      erro: "Erro interno do servidor",
      detalhes: err.message
    });
  }
});

// =========================
// EDITAR PRODUTO
// =========================

app.put("/api/produtos/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
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
      console.error("Erro Supabase ao editar:", error);

      return res.status(500).json({
        erro: "Erro ao editar produto",
        detalhes: error.message,
        codigo: error.code
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Produto atualizado!",
      produto: data
    });
  } catch (err) {
    console.error("Erro interno:", err);

    res.status(500).json({
      erro: "Erro interno do servidor",
      detalhes: err.message
    });
  }
});

// =========================
// EXCLUIR PRODUTO
// =========================

app.delete("/api/produtos/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
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
      console.error("Erro Supabase ao excluir:", error);

      return res.status(500).json({
        erro: "Erro ao excluir produto",
        detalhes: error.message,
        codigo: error.code
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Produto excluído!",
      produto: data
    });
  } catch (err) {
    console.error("Erro interno:", err);

    res.status(500).json({
      erro: "Erro interno do servidor",
      detalhes: err.message
    });
  }
});

// =========================
// SERVIDOR
// =========================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;