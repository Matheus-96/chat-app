# Chat Writing Coach

MVP de chat em tempo real para pratica de writing em ingles, com salas compartilhadas por link e feedback privado da IA para quem enviou a mensagem.

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

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


1. Informar nome e chave OpenRouter no frontend.
2. Criar uma sala e copiar o link.
3. Entrar na sala por WebSocket.
4. Enviar mensagens publicas em tempo real.
5. Receber uma mensagem privada do coach com a frase corrigida e a explicacao.

## Estado atual da implementacao

- Backend com endpoints HTTP: `GET /health`, `POST /api/rooms`, `GET /api/rooms/:roomId`.
- Realtime em `ws` com eventos de snapshot da sala, atualizacao de participantes e mensagens.
- Correcao de writing executada em paralelo no envio da mensagem.
- Mensagem do coach enviada como privada para o autor da mensagem original.
- Identidade por aba corrigida com `sessionStorage` para evitar conflito entre participantes no mesmo navegador.

## Mudancas planejadas para a proxima iteracao

### Menu de opcoes do chat

Adicionar um menu no chat com modo de analise do coach:

- `Automatico`: toda mensagem enviada dispara o coach automaticamente.
- `Manual`: o envio da mensagem nao dispara analise; o usuario clica em uma acao ao lado da propria mensagem para solicitar analise.

Regra de visibilidade mantida: a resposta do coach continua privada para o autor.

### Separacao de paginas

Dividir a experiencia em duas paginas:

- `Landing page`:
	- Explicacao basica do produto.
	- Input de nome do usuario.
	- Input para nome/codigo da sala existente.
	- Botao para conectar em sala existente.
	- Botao para criar nova sala.
- `Pagina de chat`:
	- Conversa em tempo real.
	- Lista de participantes.
	- Composer de mensagem.
	- Menu do coach (Automatico/Manual).
	- Acao de "Analisar com coach" por mensagem no modo Manual.

## Limites atuais

- Persistencia somente em memoria no backend.
- TTL de 24 horas por sala, renovado por atividade.
- Correcoes privadas apenas para o autor da mensagem.
- Sem autenticacao e sem persistencia real de historico entre reinicios do servidor.
- Fluxo ainda em pagina unica (landing e chat ainda nao estao separados).