# Supermercado Vieira

Sistema de gestão da loja com interface em português, API Express e banco compartilhado no Supabase. A versão hospedada no Render acompanha a branch principal.

[Abrir o sistema](https://supermercado-vieira-docker.onrender.com/)

## Entrar e salvar

1. Na [página de acesso](https://supermercado-vieira-docker.onrender.com/acesso), peça o link de entrada com o e-mail do gerente ou escolha **Usar senha**. Para definir uma senha, abra [Criar ou recuperar senha](https://supermercado-vieira-docker.onrender.com/recuperar-senha). O botão da mensagem mais recente abre **Criar nova senha**, inclusive em outro navegador. Depois de salvar, use a senha no login. A sessão dura até uma hora.
2. Em **Produtos**, preencha o cadastro e clique em **Salvar produto**. A confirmação depende da gravação no banco. Em outro computador ou celular, entre com a conta autorizada e abra Produtos.
3. Contas, funcionários, categorias e vales são gravados no mesmo banco ao confirmar os formulários. Se duas pessoas editarem o mesmo registro, a versão mais antiga precisa ser recarregada.
4. Para trazer dados da versão anterior, entre pelo endereço e navegador em que foram cadastrados e clique em **Salvar tudo**. A importação preserva os IDs e os vínculos de vales e pode ser repetida. Produtos antigos que tinham apenas o estoque usam o preço inicial de R$ 0,00 até o gerente informar o valor. Tema, brilho e imagem de preferência são locais.

## Modo visitante

Na página de acesso, **Entrar como visitante** abre o sistema completo com dados de demonstração. Todas as telas funcionam, inclusive cadastrar, editar e excluir, mas as alterações ficam só na aba aberta e somem ao clicar em **Sair** ou fechar a aba. O modo visitante não consulta nem altera o banco da loja: as chamadas à API são respondidas por `assets/js/visitante.js` no próprio navegador. Ao voltar para a página de acesso, o modo é encerrado.

## Dashboard

Em **Pendências**, o gráfico compara os valores a pagar e a receber pelo mês de vencimento. O período inclui o mês atual e os cinco anteriores. O filtro abre em **Em aberto hoje** e também permite ver **Todas as contas**, inclusive as já liquidadas. **Ver valores por mês** apresenta os números exatos da comparação. O gráfico separado de fluxo considera as datas efetivas de pagamento e recebimento.

## Configurar e testar

Na raiz, execute `npm ci`, `npm test` e `npm start`. O banco já utilizado pela loja possui a tabela `public.produtos`. As migrações em `supabase/migrations` documentam a evolução a partir dessa tabela e das políticas originais do projeto. Antes de liberar o serviço em outro ambiente, configure a lista de gerentes em `public.vieira_gerentes` pelo painel administrativo.

Configure `SUPABASE_URL`, `SUPABASE_KEY` (chave publicável) e `VIERA_GERENTE_EMAIL` no serviço, ou em `backend/.env` durante o desenvolvimento. Mantenha arquivos de ambiente e credenciais fora do repositório.

A API valida a sessão e usa o token do gerente nas consultas. As políticas por linha do Supabase protegem as operações no banco. O navegador recebe um cookie HTTP-only com SameSite estrito e Secure em produção. O identificador de cadastro evita duplicação de produtos em novas tentativas. A versão de cada registro protege as edições simultâneas.

Os testes de API usam uma loja em memória com sessões independentes. A suíte `npm run test:browser` verifica as transições com Chromium e também usa essa loja. Defina `CHROME_PATH` quando o navegador estiver fora do caminho padrão. Nenhuma suíte usa o banco de produção.

[Controle de acesso no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Autorização na OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

### Retorno dos links de acesso

No painel Supabase, em **Authentication → URL Configuration**, o **Site URL** é `https://supermercado-vieira-docker.onrender.com/`. A recuperação volta para `/recuperar-senha` nesse site. O servidor valida a identidade no Supabase e confere as permissões no banco antes de permitir a troca de senha. Para a entrada por e-mail, autorize em **Redirect URLs** o endereço exato de `/acesso` de cada publicação. Nesse fluxo, abra o link no navegador em que iniciou o pedido ou cole o endereço original do botão no formulário. Na Vercel, as rotas de API encaminham as requisições ao Render.
