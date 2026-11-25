# Supermercado Vieira

Sistema de gestão da loja com interface em português, API Express e banco compartilhado no Supabase. A versão hospedada no Render acompanha a branch principal.

[Abrir o sistema](https://supermercado-vieira-docker.onrender.com/)

## Entrar e salvar

1. Informe o e-mail do gerente cadastrado. Abra o link enviado ao e-mail no mesmo navegador em que pediu o acesso. A sessão dura até uma hora.
2. Em **Produtos**, preencha o cadastro e clique em **Salvar produto**. A confirmação depende da gravação no banco. Em outro computador ou celular, entre com a conta autorizada e abra Produtos.
3. Contas, funcionários, categorias e vales são gravados no mesmo banco ao confirmar os formulários. Se duas pessoas editarem o mesmo registro, a versão mais antiga precisa ser recarregada.
4. Para trazer dados da versão anterior, entre pelo endereço e navegador em que foram cadastrados e clique em **Salvar tudo**. A importação preserva os IDs e os vínculos de vales e pode ser repetida. Produtos antigos que tinham apenas o estoque usam o preço inicial de R$ 0,00 até o gerente informar o valor. Tema, brilho e imagem de preferência são locais.

## Dashboard

Em **Pendências**, o gráfico compara os valores a pagar e a receber pelo mês de vencimento. O período inclui o mês atual e os cinco anteriores. O filtro abre em **Em aberto hoje** e também permite ver **Todas as contas**, inclusive as já liquidadas. **Ver valores por mês** apresenta os números exatos da comparação. O gráfico separado de fluxo considera as datas efetivas de pagamento e recebimento.

## Configurar e testar

Na raiz, execute `npm ci`, `npm test` e `npm start`. O banco já utilizado pela loja possui a tabela `public.produtos`. As migrações em `supabase/migrations` documentam a evolução a partir dessa tabela e das políticas originais do projeto. Antes de liberar o serviço em outro ambiente, configure a lista de gerentes em `public.vieira_gerentes` pelo painel administrativo.

Configure `SUPABASE_URL`, `SUPABASE_KEY` (chave publicável) e `VIERA_GERENTE_EMAIL` no serviço, ou em `backend/.env` durante o desenvolvimento. Mantenha arquivos de ambiente e credenciais fora do repositório.

A API valida a sessão e usa o token do gerente nas consultas. As políticas por linha do Supabase protegem as operações no banco. O navegador recebe um cookie HTTP-only com SameSite estrito e Secure em produção. O identificador de cadastro evita duplicação de produtos em novas tentativas. A versão de cada registro protege as edições simultâneas.

Os testes de API usam uma loja em memória com sessões independentes. A suíte `npm run test:browser` verifica as transições com Chromium e também usa essa loja. Defina `CHROME_PATH` quando o navegador estiver fora do caminho padrão. Nenhuma suíte usa o banco de produção.

[Controle de acesso no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Autorização na OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

### Retorno dos links de acesso

No painel do projeto Supabase, em **Authentication → URL Configuration**, use `https://supermercado-vieira-docker.onrender.com/` como **Site URL**. Se outros domínios da loja forem usados para solicitar acesso, inclua suas URLs de retorno exatas em **Redirect URLs**. O fluxo do botão por e-mail usa PKCE e requer o navegador que iniciou o envio. Na publicação Vercel, as rotas da API encaminham as requisições para o backend Render.
