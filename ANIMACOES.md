# Abertura e saida Vieira

O projeto mantem HTML e JavaScript com navegacao nativa entre documentos.

## Identidade e sequencia

`assets/img/logo-symbol.svg` contem o contorno vetorial isolado do simbolo das imagens fornecidas, com transparencia e gradientes azul/roxo. Os arquivos originais da marca e as imagens usadas nas paginas permanecem intactos.

`assets/js/transitions.js` controla apenas a primeira abertura por aba e o logout explicito. A entrada aguarda o documento e a decodificacao do simbolo. Fundo circular e logo pertencem ao mesmo elemento `.sv-entry-object`: uma unica transformacao anima os dois de forma inseparavel, com centro e proporcao constantes.

O diametro inicial cobre a diagonal da viewport com margem de 2%, inclusive em telas ultrawide. A contracao dura 800 ms com `cubic-bezier(.4,0,.2,1)`, revelando a pagina pelas extremidades em direcao ao centro, sem fade independente no fundo ou na pagina. A finalizacao usa o mesmo objeto por 250 ms: giro de 12 graus, escala de 1 para 0.9 e fade-out. O JavaScript aguarda o termino real de cada animacao antes de avancar e liberar a interacao. O calculo de cobertura acompanha mudancas de tamanho da janela.


O logout usa o gancho visual `showGoodbye(onComplete)` ja previsto em `auth.js`: uma cobertura parte do centro, apresenta o simbolo com uma breve rotacao e chama a conclusao original apos aproximadamente 1 segundo. O arquivo de autenticacao nao e modificado. Chamadas repetidas nao criam overlays duplicados.

`assets/css/transitions.css` concentra os movimentos em `transform` e `opacity`. O proprio fundo circular em contracao funciona como cobertura, sem uma segunda mascara animada. O simbolo vetorial mantem nitidez nas diferentes escalas. Nao ha interceptacao de links nem animacoes na navegacao interna. O controle `sv_opening_seen` em `sessionStorage` evita repetir a abertura ao navegar, atualizar ou retornar do logout na mesma aba.

## Acessibilidade e recuperacao

Com `prefers-reduced-motion`, a entrada e omitida e a saida executa imediatamente sua conclusao original. Uma mudanca dessa preferencia durante a animacao tambem libera a interface. O tema claro/escuro e respeitado. Falha na imagem, retorno pelo historico e um limite de seguranca de 8 segundos nao deixam a interface bloqueada. O limite e uma protecao, nao a duracao normal da abertura.

As linhas coloridas do Dashboard e da marca lateral continuam com os ciclos existentes em `style.css`. Backend, API, banco, credenciais, destinos e estrutura das paginas nao sao alterados.

## Verificacao

### Transição exclusiva após login válido

`assets/js/login-transition.js` e `assets/css/login-transition.css` cuidam apenas da passagem do formulário para o Dashboard. A validação original continua em `index.html`; somente após o sucesso o botão é bloqueado e a transição é iniciada.

Logo e forma vermelha pertencem a um único elemento animado, com centro e proporção constantes. A sequência usa 250 ms de entrada, 600 ms de expansão, 600 ms de contração no Dashboard e 250 ms de finalização: aproximadamente 1,7 segundo, além do carregamento real do documento.

A navegação só ocorre depois de concluir a expansão e apresentar um quadro completamente coberto. O marcador visual `sv_login_handoff` em `sessionStorage` é consumido uma única vez, somente no endereço do Dashboard e por até 30 segundos. O script no destino cria a cobertura no `<head>`, antes dos scripts de gráficos e da apresentação do conteúdo. Depois do documento e da imagem estarem prontos, continua a contração. Não há mudanças nos efeitos de abertura ou logout, nem interceptação da navegação interna.

Movimento reduzido segue diretamente ao Dashboard. Falhas na imagem ou indisponibilidade do armazenamento não impedem o login. Os testes verificam credenciais inválidas, cliques duplicados, cobertura nos dois lados da navegação, consumo do marcador e ausência de repetição nas páginas internas. As capturas opcionais incluem a expansão do login e a revelação do Dashboard.

Execute `node --check assets/js/transitions.js` e `node tests/transitions.mjs`.

O teste usa Node 24 e Chrome headless (`CHROME_PATH` permite outro executavel), perfil isolado e servidor local. Usa produtos ficticios vazios e um substituto de Chart para testar a apresentacao sem depender do backend ou de CDNs.

Verifica uma unica animacao compartilhada, proporcao constante entre fundo/logo, centro comum, cobertura em desktop/ultrawide/celular/paisagem, finalizacao de 250 ms, logout preservado, login, oito paginas, historico, temas e movimento reduzido. `node tests/transitions.mjs --screenshots` tambem salva capturas das fases em uma pasta temporaria e informa os caminhos.
