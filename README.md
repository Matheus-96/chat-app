# Chat Writing Coach

MVP de chat em tempo real para pratica de writing em ingles, com salas compartilhadas por codigo curto e feedback de IA integrado ao fluxo da conversa.

## Stack inicial

- Frontend: React + Vite + TypeScript
- Backend: Express + WebSocket (`ws`) + TypeScript
- IA: OpenRouter por chave fornecida pelo usuario no navegador

## Como rodar

### Backend

```bash
cd backend
npm install
npm run dev
```

Servidor padrao em `http://localhost:3001`.

Variaveis opcionais:

- `DEFAULT_OPENROUTER_API_KEY`: chave fallback caso o frontend nao envie uma chave.
- `OPENROUTER_MODEL`: modelo padrao no OpenRouter.
- `FRONTEND_ORIGIN`: origem permitida para CORS.
- `OPENROUTER_HTTP_REFERER`: header recomendado pelo OpenRouter.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App padrao em `http://localhost:5173`.

Variaveis opcionais:

- `VITE_API_BASE_URL`: sobrescreve a base da API HTTP.
- `VITE_WS_URL`: sobrescreve a URL do WebSocket.

## Fluxo implementado

1. Informar nome e chave OpenRouter na landing page.
2. Criar uma sala e receber um roomCode curto para compartilhar.
3. Entrar na sala por URL ou pelo codigo curto.
4. Enviar mensagens publicas em tempo real.
5. Receber a correcao do coach vinculada a mensagem original na timeline da sala.

## Estado atual da implementacao

- Frontend com landing page e pagina de sala separadas por rota.
- Backend com endpoints HTTP: `GET /health`, `POST /api/rooms`, `GET /api/rooms/:roomId`, `GET /api/rooms/code/:roomCode`.
- Realtime em `ws` com eventos de snapshot da sala, atualizacao de participantes, digitacao, mensagens e mudanca do modo do agente.
- Modo do agente por participante com opcoes `Automatico` e `Manual`.
- Correcao de writing executada automaticamente ou por acao manual, sem reenviar a mensagem original.
- Correcao do coach exibida na timeline da sala ligada a `replyToMessageId`.
- Identidade por aba mantida com `sessionStorage` para evitar conflito entre participantes no mesmo navegador.

## Interface atual

### Landing page

- Explicacao do produto.
- Inputs de nome e API Key.
- Criacao de nova sala.
- Entrada em sala existente por codigo curto ou URL.

### Pagina de chat

- Painel lateral com modo do agente, participantes e informacoes da sala.
- Composer fixo com suporte a `Ctrl+Enter` no modo Manual.
- Baloes de mensagem com correcao vinculada e popover de explicacao.
- Botao por mensagem para `Analisar com agente` no modo Manual.
- Indicador de digitacao, notificacao do navegador e som de nova mensagem.

## Limites atuais

- Persistencia somente em memoria no backend.
- TTL de 24 horas por sala, renovado por atividade.
- Correcoes exibidas para quem estiver na sala.
- Sem autenticacao e sem persistencia real de historico entre reinicios do servidor.
- Sem banco de dados, moderacao ou historico longo.