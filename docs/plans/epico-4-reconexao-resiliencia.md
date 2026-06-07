# Plano: Épico 4 — Reconexão e Resiliência

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** [docs/prd.md](../prd.md) — Épico 4

## 1. O que estamos construindo

Reconexão automática com backoff exponencial no módulo WS do frontend. Quando a conexão cai inesperadamente, o cliente tenta reconectar até 10 vezes com delays crescentes (1s → 2s → 4s → 8s… cap de 30s), mantendo o estado `'reconnecting'` durante as tentativas. Ao reconectar, re-envia `join_room` e aguarda novo `room_snapshot` para restaurar o estado. Após 10 falhas, transiciona para `'disconnected'` com mensagem de erro e botão manual na sidebar.

## 2. Fora do escopo

- Reconexão no backend (sessão WS é stateless — servidor sempre aceita novo `join_room`)
- Persistência de mensagens escritas durante desconexão (out of scope no PRD)
- Modo offline ou fila de mensagens pendentes

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Backoff inteiramente dentro de `client.ts` (não no hook, não no componente) | PRD determina explicitamente: "lógica de backoff exponencial no módulo WS, não dentro de componentes" | `connect()` recebe closure com flag `stopped`, contador de tentativas e `createSocket()` interno; hook não conhece a lógica de retry |
| AD-2 | Flag `stopped` é setada **antes** de `socket.close()` em `client.close()` | Garante que `onclose` disparado pelo fechamento intencional (unmount, reconexão manual) não inicia loop de retry | `stopped = true` → `socket.close()` → `onclose` verifica `stopped` → return |
| AD-3 | Status `'connecting'` apenas na primeira conexão; reconexões mantêm `'reconnecting'` até abrir | Evita flickering de status para o usuário durante tentativas internas | `createSocket()` não chama `setConnection('connecting')`; só `socket.onopen` chama `setConnection('connected')` |
| AD-4 | `reconnect()` em `useRoomConnection` cria nova chamada de `connect()` (via `reconnectKey`) — não reutiliza a instância antiga | Botão manual de reconexão (estado `'disconnected'`) deve resetar o contador de tentativas e começar do zero | `close()` da instância anterior cancela timers pendentes antes de nova instância ser criada |

## 4. Requisitos

- RF-1: Ao detectar fechamento inesperado, o cliente define `connection = 'reconnecting'` e agenda nova tentativa com delay exponencial: `min(1000 * 2^(tentativa-1), 30000)` ms
- RF-2: Após 10 tentativas sem sucesso, o cliente define `connection = 'disconnected'` e `error = 'Não foi possível reconectar. Clique em Reconectar para tentar novamente.'`
- RF-3: Ao reconectar com sucesso (`socket.onopen`), o cliente reseta o contador, define `connection = 'connected'`, re-envia `join_room` e `set_agent_mode`
- RF-4: Novo `room_snapshot` restaura automaticamente o estado da sala (mensagens, participantes) via `applySnapshot` já existente
- RF-5: Se a sala expirou durante a queda, o servidor responde com `room_expired` — o cliente redireciona (comportamento já implementado via `markExpired`)
- RF-6: Composer permanece desabilitado em `'reconnecting'` e `'disconnected'` (já garantido por `connection !== 'connected'`)
- RF-7: Sidebar exibe rótulos em português legíveis para cada estado de conexão
- RNF-1: `client.close()` cancela qualquer timer de retry pendente — sem tentativas órfãs após unmount
- RNF-2: TypeScript compila sem erros após cada task

## 5. Critérios de Aceite Globais

- [ ] Ao matar o servidor e reiniciá-lo, o cliente reconecta automaticamente e restaura o estado da sala sem reload
- [ ] Sidebar exibe "Reconectando..." durante tentativas e "Desconectado" após 10 falhas
- [ ] Mensagem de erro aparece na área de chat após 10 tentativas falhas
- [ ] Botão "Reconectar" na sidebar funciona do estado `'disconnected'` e reinicia o ciclo do zero
- [ ] Nenhuma tentativa de reconexão ocorre após unmount do componente (navegar para outra rota)
- [ ] Se sala expirou durante queda, `room_expired` chega no reconnect e redireciona para landing
- [ ] `cd frontend && npm run build` passa sem erros de TypeScript
- [ ] Testes de reconexão passam: `cd frontend && npx vitest run`

## 6. Tasks

### Fase 1: Tracer Bullet — backoff automático E2E
> Entrega: queda de conexão resulta em reconexão automática com estado correto na store — fluxo completo sem intervenção do usuário

#### Task 1: Refatorar `client.ts` com reconexão automática por backoff

- **Prova:** que a lógica de retry vive inteiramente no módulo WS e a store reflete as transições corretas sem alterações no hook ou componentes
- **Done-when:**
  - [ ] `connect()` extrai função interna `createSocket()` que cria o `WebSocket` e registra handlers
  - [ ] `socket.onclose` verifica `stopped`, `store.expired` e `attempts < MAX_ATTEMPTS (10)` antes de agendar retry
  - [ ] Retry usa `setTimeout(createSocket, Math.min(1000 * 2 ** attempts, 30_000))` e incrementa `attempts`
  - [ ] Após 10 tentativas sem `onopen`: `setConnection('disconnected')` + `setError('Não foi possível reconectar...')`
  - [ ] `socket.onopen` reseta `attempts = 0`, chama `setConnection('connected')`, re-envia `join_room` e `set_agent_mode`
  - [ ] `client.close()` seta `stopped = true`, cancela timer pendente com `clearTimeout`, fecha socket
  - [ ] `client.ts` permanece ≤ 120 linhas
  - [ ] `cd frontend && npm run build` sem erros TypeScript
- **Verificar:** subir backend, entrar na sala, derrubar backend (`Ctrl+C`), ver "Reconectando..." na sidebar; subir backend novamente, ver estado restaurado automaticamente
- **Balizador:** Se a lista de participantes reaparece na sidebar sem reload após o backend voltar, a reconexão está funcionando E2E.

#### Task 1T: Testes — reconexão automática com WebSocket mockado

- **Cobre:** lógica de backoff e transições de estado em `client.ts` / `useRoomConnection`
- **Done-when:**
  - [ ] Mock de `WebSocket` global no setup de testes permite controlar `onopen`, `onclose`, `onmessage`
  - [ ] Teste: close inesperado → `connection = 'reconnecting'` → nova instância criada após delay
  - [ ] Teste: 10 closes consecutivos sem open → `connection = 'disconnected'` + `error` setado
  - [ ] Teste: close → reconnecting → open → `connection = 'connected'` + `join_room` re-enviado
  - [ ] Teste: `client.close()` durante tentativa → nenhuma nova instância criada (timer cancelado)
  - [ ] `cd frontend && npx vitest run` passa sem falhas
- **Verificar:** `cd frontend && npx vitest run src/shared/ws/__tests__/client.test.ts`

---
**Checkpoint Fase 1:** build limpo + reconexão automática funciona manualmente + testes de backoff passam → aprovação para continuar.

---

### Fase 2: UI — status de conexão legível
> Entrega: usuário vê rótulos em português durante reconexão e sabe o que fazer ao desconectar

#### Task 2: Rótulos de conexão em português na Sidebar

- **Prova:** que o estado de conexão é comunicado de forma acionável ao usuário — não apenas como um valor técnico em inglês
- **Done-when:**
  - [ ] Função `formatConnectionStatus(status: ConnectionStatus): string` em `Sidebar.tsx` ou `shared/utils.ts` retorna: `'connecting'` → "Conectando...", `'connected'` → "Conectado", `'reconnecting'` → "Reconectando...", `'disconnected'` → "Desconectado"
  - [ ] Sidebar usa `formatConnectionStatus` no `<dd>` de Status
  - [ ] `Sidebar.tsx` permanece ≤ 120 linhas
  - [ ] `cd frontend && npm run build` sem erros
- **Verificar:** entrar na sala → ver "Conectado"; derrubar backend → ver "Reconectando..." piscando conforme tentativas; após 10 falhas → "Desconectado"
- **Balizador:** Se `<dd>` em Status exibe "Reconectando..." (não "reconnecting") durante queda, está correto.

---
**Checkpoint Fase 2:** build limpo em frontend + todos os critérios de aceite globais atendidos.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `client.ts` ultrapassa 120 linhas após refator | Média | Baixo | Extrair constantes (`MAX_ATTEMPTS`, `MAX_DELAY`) para topo do arquivo; manter `createSocket` interna como função nomeada simples |
| Mock de `WebSocket` global no jsdom conflitar com implementação nativa | Média | Médio | Usar `vi.stubGlobal('WebSocket', MockWS)` com `afterEach(() => vi.unstubAllGlobals())` para isolar |
| Timer de backoff vazar entre testes (estado global) | Média | Médio | Usar `vi.useFakeTimers()` + `vi.clearAllTimers()` no `afterEach`; resetar store Zustand com `INITIAL_STATE` |
| Reconexão disparada ao navegar para outra rota (unmount parcial) | Baixa | Alto | Verificar manualmente navegação `/room/:code` → `/` e confirmar que nenhum timer fica pendente via DevTools |
| `set_agent_mode` re-enviado no reconnect usa valor desatualizado do closure | Baixa | Baixo | `argsRef.current.initialAgentMode` em `useRoomConnection` já usa ref — o valor atual do store deve ser lido na hora do re-envio; ajustar `createSocket` para ler `useRoomStore.getState().agentMode` |

## 8. Perguntas em aberto

- (nenhuma)
