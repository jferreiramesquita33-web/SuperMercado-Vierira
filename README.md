# Supermercado Vieira

Sistema de gestão com interface HTML/CSS/JavaScript, API Express e produtos no Supabase.

Site: https://sistema-vieira.vercel.app/

## Executar e testar

Na raiz do projeto, execute `npm ci` e `npm start`. Os testes são executados com `npm test` e usam um banco simulado, sem modificar os produtos reais.

No desenvolvimento local, configure `SUPABASE_URL` e `SUPABASE_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) em `backend/.env`. No Vercel, essas variáveis ficam nas configurações do projeto. Chaves secretas devem permanecer no servidor e fora do GitHub.

## Se os produtos não carregarem

A página consulta `/api/produtos`; o servidor consulta a tabela `produtos` no Supabase. `/api/teste` verifica apenas a API, sem testar a conexão com o banco.

Se `/api/teste` funcionar e `/api/produtos` retornar `TypeError: fetch failed`, confira se o projeto do Supabase está ativo e se a URL está correta. Um projeto pausado precisa ser retomado no painel do Supabase. A troca de arquivos no GitHub, por si só, não reativa um banco pausado.

Esta correção devolve HTTP 503 para falhas de conexão com o banco, apresenta uma mensagem compreensível e acrescenta o botão **Tentar novamente**. Uma falha de leitura mantém a cópia anterior dos produtos no navegador; o sistema continua exigindo confirmação da API para salvar alterações.

A página de Produtos também mostra o menu e o aviso **Carregando produtos…** antes de aguardar a API. A consulta tem limite de 15 segundos; se não terminar, a tela apresenta uma mensagem de demora e permite tentar novamente, em vez de permanecer apenas com o fundo escuro.

Referência: https://supabase.com/docs/guides/platform/free-project-pausing

### Edição e exclusão de produtos

No Render, defina `VIERA_GERENTE_EMAIL` com o endereço do gerente autorizado em `public.vieira_gerentes`. Mantenha a URL do Supabase e sua chave publicável em `SUPABASE_URL` e `SUPABASE_KEY`. O projeto usa a função `public.vieira_e_gerente()` e as políticas de edição e exclusão da tabela `produtos`.

Ao editar, marcar uma compra ou excluir, o sistema pede confirmação por e-mail. Copie o link do botão da mensagem para o formulário de Produtos ou use o código, se a mensagem incluir um. A operação continua após a confirmação. A sessão de edição dura até uma hora e termina ao sair do sistema.
