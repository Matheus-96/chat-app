# Plano: Épico 3 — Chat em Tempo Real

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** [docs/prd.md](../prd.md) — Épico 3

## 1. O que estamos construindo

Refinamento arquitetural do canal WebSocket de chat: extração do use case `SendMessage` e do módulo `RateLimiter` para as camadas corretas, mais remoção dos campos legados (`visibility`, `visibleToParticipantId`, `analysisMode`) do modelo e protocolo. A funcionalidade de chat em tempo real já existe — este épico a coloca na arquitetura definida no PRD sem alterar comportamento observável.

## 2. Fora do escopo

- Integração com IA / `AIProvider` (Épico 5)
- Campo `customInstructions` nos eventos WS (Épico 5, junto com AIProvider)
- Reconexão automática com backoff exponencial (Épico 4)
- Eventos `reaction_added` / `reaction_removed` (Épico 8)
- Campo `error`/`errorReason` em `correction_finished` (Épico 5)

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | `RateLimiter` é módulo standalone em `infrastructure/RateLimiter.ts`, não método de `StorageAdapter` | Rate limiting é preocupação transversal — acoplá-lo ao adapter obriga reescrita em qualquer adapter futuro (Redis, Postgres) | `canSendMessage()` removido de `StorageAdapter` e `InMemoryAdapter`; handler recebe instância de `RateLimiter` |
| AD-2 | `SendMessage` use case (Épico 3) não orquestra IA | Integração com `AIProvider` chega no Épico 5; separar agora evita acoplamento prematuro | Use case recebe apenas `{storage, roomId, authorId, authorName, content}` e retorna `RoomMessage`; handler continua chamando `processCoachAnalysis` diretamente até o Épico 5 |
| AD-3 | `analysisMode` removido do protocolo e do modelo sem substituto imediato | PRD marca campo como removido; `customInstructions` chega junto com `AIProvider` no Épico 5 | `sendMessageSchema` e `analyzeMessageSchema` não aceitam mais `analysisMode`; `processCoachAnalysis` perde o parâmetro |
| AD-4 | `visibility` e `visibleToParticipantId` removidos do modelo | Todas as mensagens são públicas por decisão de produto — o campo não tem uso real e é débito técnico explícito no PRD | `RoomMessage` fica sem esses campos; `addMessage` no storage não os recebe nem os grava |

## 4. Requisitos

- RF-1: O sistema deve aceitar mensagens de até 800 caracteres via WS, rejeitando conteúdo excedente com evento `error`.
- RF-2: O sistema deve limitar envio por conexão a `RATE_LIMIT_MAX` msgs / `RATE_LIMIT_WINDOW_MS` ms (padrão 10/15s); exceder retorna evento `error`.
- RF-3: O use case `SendMessage` deve adicionar a mensagem ao storage e retorná-la, sem conhecimento de HTTP/WS.
- RF-4: O `RateLimiter` deve ser módulo isolado configurável via env vars, sem acoplamento ao `StorageAdapter`.
- RF-5: `RoomMessage` não deve conter `visibility`, `visibleToParticipantId` nem `analysisMode`.
- RF-6: O indicador de digitação deve ser propagado em tempo real para todos os outros participantes da sala (comportamento atual preservado).
- RNF-1: `RateLimiter` usa sliding window em memória.
- RNF-2: TypeScript compila sem erros após cada task.

## 5. Critérios de Aceite Globais

- [ ] `backend/src/application/usecases/SendMessage.ts` existe e é chamado pelo handler no evento `send_message`
- [ ] `backend/src/infrastructure/RateLimiter.ts` existe; `canSendMessage` removido de `StorageAdapter` e `InMemoryAdapter`
- [ ] `RoomMessage` (backend e frontend) não tem `visibility`, `visibleToParticipantId` nem `analysisMode`
- [ ] `sendMessageSchema` e `analyzeMessageSchema` no handler não têm `analysisMode`
- [ ] `cd backend && npm run build` passa sem erros de TypeScript
- [ ] `cd frontend && npm run build` passa sem erros de TypeScript
- [ ] Testes do use case `SendMessage` passam
- [ ] Testes do `RateLimiter` passam

## 6. Tasks

### Fase 1: Tracer Bullet — `SendMessage` use case wired E2E
> Entrega: o fluxo `send_message` passa pelo use case antes de chegar ao broadcast — as camadas handler → use case → storage estão conectadas

#### Task 1: Criar use case `SendMessage` e wiring no handler
- **Prova:** que a camada de use case se integra ao handler sem quebrar o broadcast de mensagens
- **Done-when:**
  - [ ] `backend/src/application/usecases/SendMessage.ts` existe e exporta função `sendMessage({storage, roomId, authorId, authorName, content}): RoomMessage`
  - [ ] Handler `send_message` chama `sendMessage(...)` em vez de `storage.addMessage()` diretamente
  - [ ] Servidor sobe sem erros (`tsx src/server.ts`)
  - [ ] Envio de mensagem resulta em `message_created` broadcast para todos os clientes da sala
- **Verificar:** `cd backend && tsx src/server.ts` — conectar 2 clientes WS na mesma sala, enviar `send_message`, ambos recebem `message_created` com o conteúdo correto
- **Balizador:** Se dois clientes veem a mesma mensagem aparecer sem erro de compilação, a integração handler → use case → storage → broadcast está no caminho certo.

#### Task 1T: Testes — use case `SendMessage`
- **Cobre:** `SendMessage` use case introduzido na Task 1
- **Done-when:**
  - [ ] Caso feliz: `sendMessage` retorna `RoomMessage` com `id`, `createdAt`, `role: 'user'`, `content` corretos
  - [ ] Caso de erro: sala inexistente resulta em exceção ou retorno `null`/`undefined` tratado pelo handler
  - [ ] `cd backend && npx vitest run --reporter=verbose` passa sem falhas
- **Verificar:** `cd backend && npx vitest run src/application/usecases/__tests__/SendMessage.test.ts`

---
**Checkpoint Fase 1:** build limpo + envio de mensagem funciona E2E + testes do use case passam → aprovação para continuar.

---

### Fase 2: Infraestrutura isolada e limpeza do modelo
> Entrega: `RateLimiter` desacoplado do adapter, modelo limpo de campos legados, backend e frontend compilam sem erros

#### Task 2: Extrair `RateLimiter` para módulo isolado
- **Prova:** que o rate limiting funciona independente do storage adapter
- **Done-when:**
  - [ ] `backend/src/infrastructure/RateLimiter.ts` existe com classe `RateLimiter({max, windowMs})`
  - [ ] `RateLimiter.check(key: string): boolean` implementa sliding window
  - [ ] `canSendMessage` removido de `StorageAdapter.ts` (interface) e de `InMemoryAdapter.ts`
  - [ ] `recentMessages: number[]` removido de `InternalConnection` em `InMemoryAdapter.ts`
  - [ ] Handler instancia `RateLimiter` com config e chama `rateLimiter.check(socketId)` no lugar de `storage.canSendMessage(socketId)`
  - [ ] `cd backend && npm run build` compila sem erros
- **Verificar:** `cd backend && npm run build` — zero erros TypeScript; comportamento de rate limit preservado (testar manualmente disparando 11 msgs em 15s)
- **Balizador:** Se o build passa e o handler rejeita a 11ª mensagem com `error`, o módulo está corretamente isolado.

#### Task 2T: Testes — `RateLimiter`
- **Cobre:** módulo `RateLimiter` introduzido na Task 2
- **Done-when:**
  - [ ] Permite envio até o limite configurado (ex.: 3/5s → permite msgs 1, 2, 3)
  - [ ] Bloqueia ao exceder o limite (msg 4 retorna `false`)
  - [ ] Libera após a janela expirar (após 5s, msg 4 retorna `true`)
  - [ ] `cd backend && npx vitest run --reporter=verbose` passa sem falhas
- **Verificar:** `cd backend && npx vitest run src/infrastructure/__tests__/RateLimiter.test.ts`

#### Task 3: Remover campos legados do modelo e schemas WS
- **Prova:** que o modelo de dados está alinhado com o PRD e o protocolo não carrega campos sem uso
- **Done-when:**
  - [ ] `StorageAdapter.ts`: `RoomMessage` sem `visibility`, `visibleToParticipantId`, `analysisMode`
  - [ ] `InMemoryAdapter.ts`: `addMessage` não recebe nem grava esses campos
  - [ ] `handler.ts`: `sendMessageSchema` e `analyzeMessageSchema` sem `analysisMode`; `processCoachAnalysis` sem parâmetro `analysisMode`
  - [ ] `frontend/src/shared/ws/protocol.ts`: tipo `RoomMessage` sem `visibility`, `visibleToParticipantId`, `analysisMode`
  - [ ] `cd backend && npm run build` e `cd frontend && npm run build` compilam sem erros
- **Verificar:** `cd backend && npm run build && cd ../frontend && npm run build` — ambos passam; grep confirma ausência dos campos removidos
- **Balizador:** Se `grep -r "visibility\|visibleToParticipantId\|analysisMode" backend/src frontend/src` retorna zero resultados relevantes e ambos os builds passam, está pronto.

---
**Checkpoint Fase 2:** build limpo em backend e frontend + testes do `RateLimiter` passam + todos os critérios de aceite globais atendidos.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Remoção de `analysisMode` quebrar `processCoachAnalysis` no handler | Alta | Médio | `processCoachAnalysis` já recebe `apiKey` e `userMessage`; remover `analysisMode` simplifica a assinatura — revisar `ai.ts` para confirmar que o `mode` não é obrigatório |
| Frontend ainda usa `visibility` em componentes de renderização | Média | Baixo | Grep por `visibility` em `frontend/src` antes de fechar a Task 3; TypeScript flagra qualquer uso residual |
| `RateLimiter` injetado no handler vs instanciado no módulo | Baixa | Baixo | Instanciar no `server.ts` e passar como argumento para `createWsHandler` — padrão já usado com `storage` |

## 8. Perguntas em aberto

- (nenhuma)
