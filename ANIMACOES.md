# Animações do Supermercado Vieira

Este repositório usa HTML e JavaScript com navegação entre documentos. A implementação mantém essa arquitetura, sem introduzir React, Vite ou React Router.

- `assets/js/transitions.js`: tela com logo, ciclo de entrada/saída, navegação e apresentação de cards inseridos posteriormente.
- `assets/css/transitions.css`: animações, microinterações, responsividade e redução de movimento.
- As nove páginas incluem esses arquivos no `<head>`, antes da primeira pintura do conteúdo.
- `goTo(url)` mantém a API de navegação existente. Links internos preservam modificadores, downloads, âncoras e abertura em outra aba.

A abertura leva aproximadamente 1,45 s em condições normais. A navegação interna usa 180 ms de saída, 220 ms de logo antes da navegação e cerca de 230 ms no destino, além do tempo de rede. A entrada do conteúdo dura 600 ms; os cards têm intervalos de 45 ms, limitados a 225 ms. Um limite de espera após o HTML estar pronto evita bloquear a interface por recursos externos lentos. Isso não representa o progresso das consultas ao backend.

O sistema respeita `prefers-reduced-motion`, mantém o tema selecionado e restaura a interface ao voltar pelo histórico. Login, autenticação, APIs e banco de dados não foram alterados. As mensagens existentes de boas-vindas e despedida foram preservadas.

## Verificação

Execute `node --check assets/js/transitions.js`, `node --check assets/js/app.js` e `node tests/transitions.mjs`.

O teste usa Node 24 e Chrome headless, sem novas dependências. No Windows, procura o Chrome no local padrão; em outra instalação, defina `CHROME_PATH`. Usa servidor local e perfil temporário isolado. Valida abertura, navegação interna, retorno pelo histórico, tema, viewport móvel e movimento reduzido. Não testa as operações do backend.
