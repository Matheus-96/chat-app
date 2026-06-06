# Plano: Épico 1 — Salas Temporárias

> **Status:** Rascunho
> **Criado em:** 2026-06-06
> **Origem:** [docs/prd.md](../prd.md) — Épico 1

## 1. O que estamos construindo

Refator completo da base do produto em duas frentes: (1) reestruturação do backend em camadas DDD leve (config, StorageAdapter, use cases, HTTP e WS handlers) e (2) adoção de Zustand + WS client desacoplado no frontend. Sobre essa base, entregamos o comportamento completo de salas temporárias: emissão de `room_expired` antes da deleção, redirecionamento com mensagem clara na landing e exibição de tempo restante na sidebar.

## 2. Fora do escopo

- Use cases além de CreateRoom e JoinRoom (SendMessage, AnalyzeMessage, AddReaction — pertencem aos Épicos 3-8)
- Zustand slices de outros épicos (reações, coach, etc.)
- Reconexão automática com backoff exponencial (Épico 4)
- Migração de testes E2E com Playwright (após todos os épicos)

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Backend em camadas: `application/usecases/`, `infrastructure/storage/`, `interface/http/`, `interface/ws/` | Testabilidade sem subir servidor; trocar implementações sem alterar use cases | `server.ts` vira bootstrap puro; toda lógica migra para use cases |
| AD-2 | `StorageAdapter` como interface + `InMemoryAdapter` como implementação atual | Permite trocar para Redis/Postgres plugando nova impl; use cases não importam a impl diretamente | Todos os use cases recebem `StorageAdapter` por parâmetro (DI) |
| AD-3 | Zustand store para estado da sala no frontend | Componentes leem slices necessários; WS client despacha para store sem acoplamento a componentes | `useRoomConnection` vira adaptador fino; `useReducer` é removido |
| AD-4 | `room_expired` emitido **antes** de deletar a sala | Clientes ainda conectados recebem o evento enquanto a sala ainda existe na memória | Loop de cleanup em `server.ts` identifica expiradas, faz broadcast, depois deleta |
| AD-5 | Máximo 120 linhas por arquivo de frontend; CSS separado por componente | Mandatório pelo PRD; sem exceções | Qualquer arquivo que exceder deve ser dividido antes do commit |

## 4. Requisitos

- RF-1: Sala possui código curto de 6 chars sem caracteres ambíguos (`0`, `O`, `I`, `1`)
- RF-2: TTL de 24h renovado a cada mensagem e a cada `join_room`
- RF-3: Ao expirar, servidor emite `room_expired` para todos os clientes antes de encerrar a sala
- RF-4: Sala expirada não pode ser reentrada; HTTP 404 em `GET /api/rooms/code/:code`
- RF-5: Cliente recebe `room_expired` e redireciona para landing com mensagem clara
- RF-6: Sidebar exibe tempo restante aproximado (ex: "23h 45min"), não data absoluta
- RNF-1: Variáveis de ambiente validadas com Zod na inicialização — falha rápida se incompleta
- RNF-2: Use cases testáveis sem subir servidor (deps injetadas por parâmetro)

## 5. Critérios de Aceite Globais

- [ ] `POST /api/rooms` retorna `roomCode` de 6 chars sem `0`, `O`, `I`, `1`
- [ ] `GET /api/rooms/code/:code` retorna 404 para sala inexistente ou expirada
- [ ] WS `join_room` renova TTL e retorna `room_snapshot` com `expiresAt` atualizado
- [ ] Sala expirada emite `room_expired` para todos os clientes conectados antes de ser removida
- [ ] Receber `room_expired` no frontend redireciona para `/` com aviso "Sala expirada"
- [ ] Sidebar exibe tempo restante em formato "Xh Ymin", não data completa
- [ ] `tsc` sem erros em backend e frontend
- [ ] Testes de CreateRoom e JoinRoom passam
- [ ] Testes da Zustand store passam

## 6. Tasks

### Fase 1: Backend DDD — Tracer Bullet
> Entrega: criar sala e entrar via WS funcionam sobre a nova arquitetura em camadas

#### Task 1: Backend foundation — config, storage, CreateRoom, rotas HTTP
- **Prova:** nova estrutura de camadas se conecta — POST cria sala via use case sem lógica em `server.ts`
- **Done-when:**
  - [ ] `backend/src/config.ts` valida todas as env vars com Zod; servidor falha na inicialização se faltarem
  - [ ] `backend/src/infrastructure/storage/StorageAdapter.ts` declara a interface (createRoom, getRoom, getRoomByCode, touchRoom, getExpiredRoomIds, cleanupExpiredRooms)
  - [ ] `backend/src/infrastructure/storage/InMemoryAdapter.ts` implementa a interface com a lógica atual de `ChatStore` limitada a salas (sem mensagens/conexões ainda)
  - [ ] `backend/src/application/usecases/CreateRoom.ts` recebe `StorageAdapter` por parâmetro e retorna a sala criada
  - [ ] `backend/src/interface/http/routes/rooms.ts` monta `POST /api/rooms`, `GET /api/rooms/:id`, `GET /api/rooms/code/:code`
  - [ ] `backend/src/server.ts` instancia deps e passa para as rotas; não contém lógica de negócio
- **Verificar:** `curl -X POST http://localhost:3001/api/rooms` retorna `{ roomCode, roomId, expiresAt }`
- **Balizador:** Se a rota HTTP retorna sem `ChatStore` importado diretamente em `server.ts`, está no caminho certo.

#### Task 2: JoinRoom use case + WS handler básico
- **Prova:** camada WS despacha para use case; handler não contém lógica de TTL nem Maps de estado
- **Done-when:**
  - [ ] `InMemoryAdapter` estendido: `joinRoom`, `getConnection`, `disconnect`, `getParticipants`, `getVisibleMessages`
  - [ ] `backend/src/application/usecases/JoinRoom.ts` recebe `StorageAdapter`, renova TTL e retorna snapshot
  - [ ] `backend/src/interface/ws/handler.ts` trata `join_room`: chama JoinRoom, emite `room_snapshot` e broadcast `participant_update`
  - [ ] `backend/src/interface/ws/handler.ts` trata `close`: remove participante e broadcast `participant_update`
  - [ ] Demais eventos existentes (typing, set_agent_mode, send_message, analyze_message) migrados para o handler sem alteração de comportamento
- **Verificar:** conectar via WS, enviar `join_room`, receber `room_snapshot` com `expiresAt` renovado
- **Balizador:** Se `handler.ts` não declara nenhum `Map` nem calcula TTL — apenas chama use cases e faz broadcast — está certo.

#### Task 1T: Testes — CreateRoom e JoinRoom
- **Cobre:** use cases `CreateRoom` e `JoinRoom` com `InMemoryAdapter` real
- **Done-when:**
  - [ ] CreateRoom: sala criada tem código de 6 chars; `expiresAt` é agora + 24h; código não contém `0`, `O`, `I`, `1`
  - [ ] JoinRoom: sala válida → retorna snapshot com participantes e mensagens; sala inexistente → retorna null; TTL renovado após join
  - [ ] Testes passam (`npm test` na raiz ou script backend equivalente)
- **Verificar:** `npm test -- --testPathPattern=usecases`

---
**Checkpoint Fase 1:** `tsc` limpo no backend; POST cria sala; WS join retorna snapshot; testes de use cases passam.

---

### Fase 2: room_expired no backend + Zustand store no frontend
> Entrega: sala expirada emite evento WS para clientes; frontend tem store Zustand pronta e WS client desacoplado

#### Task 3: room_expired emission
- **Prova:** rotina de limpeza notifica clientes conectados antes de deletar
- **Done-when:**
  - [ ] `StorageAdapter` inclui `getExpiredRoomIds(): string[]` (retorna IDs sem deletar)
  - [ ] `InMemoryAdapter` implementa `getExpiredRoomIds()`
  - [ ] Loop de cleanup em `server.ts`: chama `getExpiredRoomIds()`, faz `broadcastRoom(roomId, { type: 'room_expired' })` para cada sala, depois chama `cleanupExpiredRooms()`
  - [ ] `{ type: 'room_expired' }` adicionado ao tipo `ServerEvent` no backend
- **Verificar:** com TTL mínimo (reduzir `ROOM_TTL_MS` temporariamente no teste), aguardar o interval e confirmar que `room_expired` chega antes de `join_room` retornar erro de sala não encontrada
- **Balizador:** Se `room_expired` chega antes de `error` na reconexão, o broadcast está correto.

#### Task 4: Instalar Zustand + definir room store
- **Prova:** store compila com o shape completo para o Épico 1
- **Done-when:**
  - [ ] `zustand` instalado no frontend
  - [ ] `frontend/src/store/roomStore.ts` declara store com: `roomId`, `roomCode`, `expiresAt`, `participantId`, `participants`, `messages`, `pendingCorrections`, `agentMode`, `connection`, `expired`, `error`
  - [ ] Actions declaradas: `applySnapshot`, `applyParticipantUpdate`, `addMessage`, `setConnection`, `markExpired`, `setAgentMode`, `setError`
  - [ ] Arquivo ≤ 120 linhas
- **Verificar:** `tsc` no frontend sem erros; `useRoomStore()` importável em um componente sem crash
- **Balizador:** Se a store compila e nenhum componente a importa ainda, a fase está correta — integração vem na próxima task.

#### Task 5: WS client module + refator useRoomConnection
- **Prova:** WS client despacha para store; `useRoomConnection` não gerencia mais estado local
- **Done-when:**
  - [ ] `frontend/src/shared/ws/client.ts` exporta função `connect(args)` que cria WS, trata cada `ServerEvent` e despacha para `roomStore` via actions
  - [ ] `useRoomConnection` usa `client.connect()` no `useEffect` e não possui `useReducer`
  - [ ] Entrar na sala popula a store; componentes que leem `useRoomStore()` exibem os dados corretamente
  - [ ] `useRoomConnection.ts` e `client.ts` ≤ 120 linhas cada
- **Verificar:** abrir `/room/:code`, confirmar que a lista de participantes e mensagens aparecem na UI
- **Balizador:** Se o React DevTools mostra o estado da sala na Zustand store ao entrar na sala, o despacho está funcionando.

#### Task 4T: Testes Zustand store
- **Cobre:** transições de estado da `roomStore`
- **Done-when:**
  - [ ] `applySnapshot` popula todos os campos corretamente
  - [ ] `setConnection('reconnecting')` atualiza o campo sem afetar os demais
  - [ ] `markExpired()` seta `expired: true`
  - [ ] Testes passam com `npm test`
- **Verificar:** `npm test -- --testPathPattern=roomStore`

---
**Checkpoint Fase 2:** sala expirada emite `room_expired` no backend; store Zustand compila e é populada ao entrar na sala; testes de store passam.

---

### Fase 3: Épico 1 completo no frontend
> Entrega: usuário recebe room_expired e é redirecionado com mensagem; sidebar exibe tempo restante

#### Task 6: room_expired no protocolo + redirect
- **Prova:** evento WS encadeia redirect para landing sem lógica espalhada em componentes
- **Done-when:**
  - [ ] `{ type: 'room_expired' }` adicionado ao `ServerEvent` em `frontend/src/shared/ws/protocol.ts`
  - [ ] WS client trata `room_expired` → chama `roomStore.markExpired()`
  - [ ] `RoomPage` lê `store.expired` em `useEffect` e chama `navigate('/', { state: { expired: true } })`
  - [ ] `RoomPage.tsx` ≤ 120 linhas após a mudança
- **Verificar:** com sala de TTL mínimo, aguardar expiração e confirmar que a URL muda para `/` e `location.state.expired === true`
- **Balizador:** Se a URL muda para `/` e o router state contém `expired: true`, o fluxo está correto.

#### Task 7: TTL restante na Sidebar
- **Prova:** usuário vê tempo humanizado e contextualmente útil, não data ISO
- **Done-when:**
  - [ ] Função `formatRemainingTime(expiresAt: string): string` em `frontend/src/shared/utils.ts` retorna "Xh Ymin", "Ymin" ou "menos de 1min"
  - [ ] `Sidebar` usa `formatRemainingTime(props.expiresAt)` no lugar de `toLocaleString`
  - [ ] `Sidebar.tsx` ≤ 120 linhas
- **Verificar:** entrar na sala, ver tempo restante humanizado na sidebar (ex: "23h 59min")
- **Balizador:** Se o campo "TTL" exibe texto com "h" ou "min" e não uma data completa, está correto.

#### Task 8: Landing — aviso de sala expirada
- **Prova:** usuário redirecionado entende o que aconteceu sem ficar em tela quebrada
- **Done-when:**
  - [ ] `LandingPage` lê `useLocation().state?.expired` e exibe aviso "Sala expirada ou não encontrada. Crie uma nova sala para continuar."
  - [ ] O aviso é visível mas não bloqueia as ações da landing (criar / entrar)
  - [ ] `LandingPage.tsx` ≤ 120 linhas
- **Verificar:** navegar para `/` com `state: { expired: true }` e ver o aviso na landing page
- **Balizador:** Se o aviso aparece e os botões "Criar nova sala" e "Entrar em sala existente" continuam funcionais, a entrega está completa.

---
**Checkpoint Fase 3:** build limpo em backend e frontend; todos os critérios de aceite globais atendidos; fluxo completo testável manualmente.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Jest + ESM no backend (`"type": "module"`) pode precisar de configuração extra | Alta | Médio | Usar `--experimental-vm-modules` ou avaliar Vitest no backend |
| Loop de cleanup de 60s dificulta teste de `room_expired` em CI | Média | Baixo | Testar a lógica de broadcast isolada do interval; interval apenas dispara a sequência |
| Arquivos frontend ultrapassarem 120 linhas durante o refator | Média | Baixo | Checar `wc -l` em cada arquivo modificado antes do commit |
| Zustand store acoplada ao WS client (import circular) | Baixa | Alto | WS client importa a store; store não importa o client — sentido único |

## 8. Perguntas em aberto

- [ ] Backend usa `"type": "module"` — Jest com ESM requer `--experimental-vm-modules`. Prefere manter Jest ou adotar Vitest também no backend para consistência?
- [ ] O `setInterval` de cleanup fica em `server.ts` (acesso direto ao `wss`) ou migra para um módulo de scheduler separado?
