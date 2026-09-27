# Calculadora de desconto — versão estática

## Arquivos
- `index.html`: estrutura da página.
- `style.css`: estilos e responsividade.
- `app.js`: validação e cálculo no navegador.

## Como executar localmente
Abra `index.html` no navegador. Não precisa instalar dependências nem iniciar servidor.

## Publicação
Os três arquivos podem ser publicados em qualquer hospedagem de site estático, por exemplo GitHub Pages, Cloudflare Pages ou Netlify. Mantenha os três arquivos no mesmo diretório e publique `index.html` como página inicial.

## Dados e privacidade
A aplicação não envia dados para APIs, não usa banco de dados e não grava os valores em localStorage/cookies. Os dados ficam apenas na memória da página enquanto ela está aberta. Ao atualizar ou fechar a página, os campos são perdidos.

## Regra do cálculo
O período sem conexão é calculado pela diferença entre retorno e queda. O desconto é arredondado para cima em dias: se houver qualquer hora/minuto/segundo além de dias completos, soma-se um dia. O bloqueio financeiro é apenas exibido e não entra no desconto, conforme o script Python fornecido.

## Observação
A aplicação estática calcula inteiramente no navegador. Não há necessidade de backend para esta funcionalidade enquanto não houver autenticação, banco de dados ou integração com outros sistemas.
