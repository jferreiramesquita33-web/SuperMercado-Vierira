const express = require("express");
const path = require("path");
const db = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Disponibiliza a interface (login, painel e páginas de gestão) junto da API.
// O diretório pai de "backend" é a raiz onde estão index.html, assets e pages.
app.use(express.static(path.join(__dirname, "..")));

app.get("/api/teste", (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "API funcionando corretamente!"
  });
});
app.get("/api/produtos", (req, res) => {
  db.all("SELECT * FROM produtos", [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        erro: "Erro ao buscar produtos"
      });
    }

    res.json(rows);
  });
});

app.post("/api/produtos", (req, res) => {
  const { nome, preco, estoque } = req.body;

  if (!nome || preco === undefined || estoque === undefined) {
    return res.status(400).json({
      erro: "Nome, preço e estoque são obrigatórios"
    });
  }

  const sql = `
    INSERT INTO produtos (nome, preco, estoque)
    VALUES (?, ?, ?)
  `;

  db.run(sql, [nome, preco, estoque], function (err) {
    if (err) {
      return res.status(500).json({
        erro: "Erro ao cadastrar produto"
      });
    }

    res.status(201).json({
      sucesso: true,
      mensagem: "Produto cadastrado!",
      id: this.lastID
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
