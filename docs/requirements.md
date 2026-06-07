# Requisitos do Produto — Chat com Coach de Escrita

## Visão geral

Aplicação web de chat em tempo real voltada para prática de escrita em inglês. Usuários entram em salas temporárias, trocam mensagens e recebem feedback automático de IA integrado ao fluxo da conversa.

---

## Entidades e modelos de dados

### Sala (`Room`)
- ID único gerado pelo sistema
- Código curto de 6 caracteres (legível, sem ambiguidade visual)
- TTL de 24 horas renovado a cada mensagem enviada e a cada `join_room`
- Lista de mensagens
- Lista de participantes conectados no momento

### Participante (`Participant`)
- ID por aba do navegador (gerado via `sessionStorage`)
- Nome livre, sem login ou cadastro
- Modo do agente: `automático` ou `manual`

### Perfil local (localStorage)
- Nome
- API Key (OpenRouter) — nunca enviada ao servidor de forma persistente
- Custom instructions (máx. 250 chars)

### Mensagem (`Message`)
- ID único
- Autor (participante ou agente de IA)
- Conteúdo textual (máx. 800 chars)
- Referência opcional à mensagem original (`replyToMessageId`)
- Campos opcionais da IA: `explanation`, `error`, `errorReason`
- Todas as mensagens são públicas — sem campo de visibilidade

### Reação (`Reaction`)
- Participante, mensagem e emoji (`👍 👎 😂 ❤️`)
- Uma reação por emoji por participante por mensagem (toggle)

---

## Funcionalidades

### 1. Gerenciamento de salas

- Criar nova sala via botão na landing page; retorna código curto e redireciona
- Entrar em sala por código curto ou por link direto (`/room/:roomCode`)
- Sala expira em 24 h de inatividade; servidor emite evento `room_expired` antes de encerrar
- TTL renovado a cada mensagem enviada e a cada nova conexão (`join_room`)
- Sidebar exibe tempo restante aproximado da sala

### 2. Identidade e perfil

- Usuário informa nome ao entrar (sem cadastro)
- Nome, API Key e custom instructions persistem em `localStorage`
- ID de sessão por aba gerado em `sessionStorage` (múltiplas abas = múltiplos participantes)
- Perfil editável na sidebar sem sair da sala

### 3. Chat em tempo real (WebSocket)

- Ao entrar na sala, cliente recebe snapshot completo: mensagens + participantes
- Mensagens propagadas em tempo real para todos na sala
- Digitação ("alguém está digitando...") propagada em tempo real
- Lista de participantes atualizada ao conectar/desconectar
- Rate limit: máx. `RATE_LIMIT_MAX` mensagens por `RATE_LIMIT_WINDOW_MS` por conexão (padrão: 10 / 15 000 ms), isolado em `RateLimiter`
- Reconexão automática com backoff exponencial (1s → 2s → 4s… cap 30s, ~10 tentativas)
- Status de conexão: `connected` | `reconnecting` | `disconnected`
- Ao reconectar: re-envia `join_room` e recebe novo `room_snapshot`
- Após falha definitiva: mensagem "não foi possível reconectar"

### 4. Coach de IA (OpenRouter)

- Integração via interface `AIProvider`; implementação padrão: `OpenRouterProvider` (OpenRouter, modelo configurável)
- API Key obrigatória no cliente para usar o coach; sem chave, coach fica desabilitado com aviso claro
- API Key e custom instructions enviadas por mensagem — nunca armazenadas no servidor
- Custom instructions: texto livre (máx. 250 chars), validado no front e no backend; IA só acata instruções relacionadas a escrita
- Resposta da IA aparece como mensagem separada vinculada (`replyToMessageId`) à original
- Todas as correções são públicas — visíveis para todos na sala
- Análise ocorre em paralelo; eventos `correction_started` / `correction_finished` indicam progresso
- Em caso de falha: `correction_finished` com `error: true` e `errorReason: 'timeout' | 'invalid_key' | 'rate_limited'`
- UI exibe "Análise indisponível" inline, sem popup; usuário pode re-disparar manualmente

### 5. Modo do agente por participante

- `Automático`: toda mensagem enviada dispara análise automaticamente
- `Manual`: análise só ocorre ao clicar em "Analisar" na mensagem ou com `Ctrl+Enter`
- Configurável individualmente; toggle na sidebar

### 6. Reações a mensagens

- Reações com `👍 👎 😂 ❤️`
- Broadcast em tempo real via WebSocket: eventos `reaction_added` / `reaction_removed`
- Contagem de reações agregada por emoji por mensagem
- Toggle: adicionar ou remover própria reação; uma reação por emoji por participante

### 7. Notificações

- Notificação sonora + Browser Notification ao receber mensagem fora de foco
- Apenas mensagens de outros participantes disparam notificação
- Próprias mensagens e correções de IA não disparam notificação

---

## Interface

### Landing page (`/`)

- Descrição breve do produto
- Campos: Nome, API Key (OpenRouter), Custom instructions (opcional, 250 chars)
- Ação "Criar nova sala"
- Ação "Entrar em sala" (aceita código curto ou link completo)
- Feedback de erro e estado de carregamento

### Sala de chat (`/room/:roomCode`)

- Layout fixo em `100dvh` sem scroll de página
- **Painel lateral**
  - Toggle modo do agente (Automático / Manual)
  - Lista de participantes com status de conexão
  - Informações do usuário: nome, API key mascarada, custom instructions (editável), código da sala, TTL restante
  - Status de conexão: `connected` | `reconnecting` | `disconnected`
- **Área de chat**
  - Lista de mensagens com scroll interno
  - Balões estilo mensageiro (próprias à direita, alheias à esquerda)
  - Correção da IA abaixo da mensagem original com separador e popover de explicação
  - "Análise indisponível" inline em caso de erro
  - Indicador de digitação
  - Footer fixo com textarea e botão de envio
  - Reações visíveis abaixo de cada mensagem com contagem

---

## Protocolo WebSocket

### Cliente → Servidor

| Evento | Payload relevante |
|--------|-------------------|
| `join_room` | `roomCode`, `participantId`, `name` |
| `send_message` | `content`, `apiKey?`, `customInstructions?`, `analyze?` |
| `analyze_message` | `messageId`, `apiKey?`, `customInstructions?` |
| `set_agent_mode` | `agentMode: 'automatic' \| 'manual'` |
| `typing` | `isTyping: boolean` |

### Servidor → Cliente

| Evento | Descrição |
|--------|-----------|
| `room_snapshot` | Estado completo da sala ao entrar |
| `participant_update` | Lista atualizada de participantes |
| `message_created` | Nova mensagem (usuário ou IA) |
| `correction_started` | IA começou a analisar mensagem |
| `correction_finished` | IA terminou; inclui `error?` e `errorReason?` |
| `reaction_added` | Reação adicionada a uma mensagem |
| `reaction_removed` | Reação removida de uma mensagem |
| `room_expired` | Sala expirou — cliente redireciona para landing |
| `typing` | Participante digitando |
| `error` | Erro de validação ou servidor |

---

## API HTTP

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| POST | `/api/rooms` | Criar sala |
| GET | `/api/rooms/:roomId` | Buscar sala por ID |
| GET | `/api/rooms/code/:roomCode` | Buscar sala por código |
| GET | `/api/messages/:id/reactions` | Listar reações de mensagem |
| POST | `/api/messages/:id/reactions` | Adicionar reação |
| DELETE | `/api/messages/:id/reactions` | Remover reação |

---

## Arquitetura

### Frontend

- React + Vite + TypeScript + TailwindCSS + React Router + React Query
- Estado global via **Zustand** (store da sala + status de conexão)
- WebSocket client desacoplado: despacha para a store, não vive dentro de componentes
- Estrutura feature-based:
  ```
  src/
  ├── features/
  │   ├── landing/components/ + hooks/
  │   └── chat/components/ + hooks/ + store.ts
  ├── shared/
  │   ├── api/          # HTTP
  │   ├── ws/           # protocolo + client
  │   ├── storage/      # localStorage / sessionStorage
  │   └── components/ui/
  └── store/index.ts    # root Zustand store
  ```
- **Máximo 120 linhas por arquivo — mandatório, sem exceções**
- CSS separado do código por componente

### Backend

- Express + `ws` + TypeScript + Zod
- Arquitetura em camadas (DDD leve):
  ```
  src/
  ├── server.ts                 # bootstrap only
  ├── application/usecases/     # CreateRoom, JoinRoom, SendMessage,
  │                             # AnalyzeMessage, AddReaction, RemoveReaction, SetAgentMode
  ├── infrastructure/
  │   ├── storage/              # StorageAdapter (interface) + InMemoryAdapter
  │   └── ai/                   # AIProvider (interface) + OpenRouterProvider
  ├── interface/
  │   ├── http/routes/
  │   └── ws/                   # handler + protocol
  └── config.ts                 # env vars validadas com Zod
  ```
- Use cases recebem `StorageAdapter` e `AIProvider` por injeção de dependência
- `RateLimiter` isolado, configurável via env vars

### Persistência

- In-memory (`InMemoryAdapter`) com cleanup de TTL via `setInterval`
- Interface `StorageAdapter` permite trocar para banco de dados sem alterar use cases

---

## Variáveis de ambiente

```env
# Servidor
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

# OpenRouter
DEFAULT_OPENROUTER_API_KEY=   # chave de fallback; deixar vazio para exigir chave do cliente
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_NAME=Chat Writing Coach

# Rate limit (mensagens por conexão)
RATE_LIMIT_MAX=10             # máximo de mensagens na janela
RATE_LIMIT_WINDOW_MS=15000    # duração da janela em milissegundos

# Frontend
VITE_API_BASE_URL=            # padrão: window.location.origin
VITE_WS_URL=                  # padrão: derivado de window.location
```

---

## Testes

- **Frontend:** Vitest + Testing Library — hooks Zustand, componentes críticos
- **Backend:** Jest — use cases com mocks de `StorageAdapter` e `AIProvider`, rotas HTTP
- **E2E:** Playwright — fluxos críticos:
  1. Criar sala → entrar → enviar mensagem → receber correção
  2. Modo manual → disparar análise → ver correção
  3. Adicionar e remover reação em tempo real

---

## Fora do escopo (esta versão)

- Login, cadastro e perfis persistidos no servidor
- Banco de dados real
- Moderação e administração de salas
- Histórico longo ou exportação
- Sincronização multi-dispositivo
- Analytics
