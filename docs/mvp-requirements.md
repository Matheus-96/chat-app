# MVP Requirements

## Objetivo

Entregar um chat web em tempo real, com experiencia visual de mensageiro, onde usuarios praticam escrita em ingles e recebem feedback de IA integrado ao fluxo da conversa.

## Contextualizacao do sistema (estado atual)

### Frontend

- App React + Vite separado em Landing page e Pagina de chat.
- Cria sala, entra em sala por codigo curto ou link e conecta websocket.
- Exibe mensagens em baloes, participantes online, digitacao e estado de conexao.
- Salva perfil local (nome + chave) no navegador.
- Usa identificador de participante por aba via `sessionStorage`.

### Backend

- API HTTP para criar sala e consultar metadados por `roomId` ou `roomCode`.
- Servidor WebSocket para entrada em sala, mensagens, digitacao, presenca e configuracao do modo do agente.
- Regras basicas de validacao e limite de taxa por conexao.
- Integracao com OpenRouter para revisar a frase em paralelo.
- Resposta do agente enviada como mensagem vinculada a mensagem original e visivel na sala.

### Persistencia

- Estado em memoria no backend.
- Salas com TTL de 24 horas renovado por atividade.
- Sem banco de dados nesta fase.

## Decisoes incorporadas

- Sem login no MVP.
- Usuario informa nome livre ao entrar na sala.
- Chave OpenRouter fica salva somente no navegador.
- Historico da sala tem retencao curta, com TTL inicial de 24 horas e acesso por codigo curto gerado pelo sistema.
- A IA responde em paralelo ao envio da mensagem.
- A resposta da IA aparece como mensagem separada do agente vinculada a mensagem original e visivel na sala.
- A arquitetura inicial e otimizada para conversa pequena, mas nao trava a evolucao para mais participantes.

## Requisitos desta iteracao

### 1. Menu de opcoes do agente no chat

Adicionar no chat um seletor de modo do agente com as opcoes:

- `Automatico`:
  - Toda mensagem enviada pelo usuario dispara analise do agente automaticamente.
  - Mantem o comportamento padrao inicial.
- `Manual`:
  - O envio da mensagem nao dispara analise automaticamente.
  - Cada mensagem propria exibe uma acao de `Analisar com agente` ao lado da mensagem.
  - A analise tambem pode ser disparada com `Ctrl + Enter`.

### 2. Separacao de paginas

Criar as paginas seguindo boas praticas de frontend em React, observando principios basicos como SOLID, componentizacao, custom hooks e isolamento de logicas pensando em manutencao futura. Separar CSS do codigo e manter cada arquivo de frontend com no maximo 120 linhas.

### Landing page

- Descricao basica do que o sistema faz.
- Informacoes basicas: Nome e API Key.
- Criar nova sala.
- Entrar em sala existente por codigo curto ou link.

### Sala de conversa

A tela deve ter altura maxima de `100dvh` e nao deve existir scroll na pagina inteira. As correcoes de IA devem ser apresentadas para todos os usuarios. A composicao esperada e:

#### Painel lateral

- Modo do agente de IA.
- Participantes da conversa.
- Informacoes do cliente: nome, API Key, reconectar e copiar link.

#### Chat

- Scroll apenas interno na lista de mensagens.
- Baloes semelhantes a apps de mensagem.
- Footer fixo com input e botao de enviar.
- Correcao exibida abaixo da mensagem original com divisor horizontal e popover de explicacao.
- Notificacoes com som e browser notification.

## Requisitos funcionais implementados nesta base

- Criar sala via API HTTP.
- Entrar na sala via codigo curto ou link especifico.
- Conectar participantes em tempo real via WebSocket.
- Enviar mensagens em formato de baloes.
- Disparar revisao de writing ao enviar uma mensagem.
- Receber retorno com frase corrigida e explicacao.
- Mostrar lista de participantes conectados.
- Alternar modo do agente entre `Automatico` e `Manual` por participante.
- Disparar analise manual por mensagem propria sem reenviar a mensagem original.

## Requisitos funcionais pendentes (prioridade alta)

- Refinar a experiencia visual da Landing page e Pagina de chat.
- Melhorar estados de erro, reconexao e feedback de carregamento.
- Cobrir os fluxos principais com testes automatizados.

## Requisitos nao funcionais iniciais

- Frontend em React + Vite + TypeScript.
- Backend simples em Express + `ws` + TypeScript.
- Persistencia inicial em memoria.
- Limite de taxa por conexao para reduzir abuso.
- CORS restrito por origem configuravel.
- Limite de 120 linhas por arquivo de frontend.

## Criterios de aceite para os novos requisitos

### agente Automatico/Manual

- Dado modo `Automatico`, quando o usuario envia mensagem, entao a analise do agente e disparada automaticamente.
- Dado modo `Manual`, quando o usuario envia mensagem, entao nenhuma analise e disparada automaticamente.
- Dado modo `Manual`, quando o usuario clicar em `Analisar com agente` em mensagem propria, entao a analise e disparada para aquela mensagem.
- Em ambos os modos, a resposta do agente fica visivel na sala ligada a mensagem analisada.

### Separacao de paginas

- Dado acesso a rota inicial, o usuario visualiza a Landing page com explicacao e formulario de entrada.
- Dado preenchimento valido na Landing page, o usuario consegue criar sala ou entrar em sala existente.
- Dado usuario em sala, a Pagina de chat carrega e exibe mensagens, participantes e composer.

## Fora do escopo desta iteracao

- Login, cadastro e perfis persistidos.
- Banco de dados real.
- Grupos completos e moderacao.
- Sincronizacao multi-dispositivo.
- Historico longo, exportacao e analytics.