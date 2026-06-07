# Plano: Épico 8 — Reações a Mensagens

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** [PRD — Épico 8](../prd.md#épico-8--reações-a-mensagens)

## 1. O que estamos construindo

Emoji reactions em tempo real (`👍 👎 😂 ❤️`) para mensagens do chat. Cada participante pode adicionar ou remover sua reação por emoji (toggle). As mudanças são propagadas via WebSocket para todos na sala e ficam visíveis abaixo de cada mensagem como contagem por emoji.

O código de reações existente (rotas HTTP, hook `useReactions`, componentes `ReactionBar/Picker/Button`) está parcialmente implementado mas desconectado: usa axios + React Query em vez de Zustand/WS e não está integrado ao `MessageBubble`. O épico finaliza essa integração com a arquitetura correta.

## 2. Fora do escopo

- Mais de 4 emojis (`👍 👎 😂 ❤️` são fixos)
- Reações privadas ou por papel (user vs. coach)
- Histórico de quem reagiu (só contagem é exibida)
- Persistência de reações além do TTL da sala
- Endpoint REST novo para reações — os existentes são mantidos para compatibilidade, mas não são o caminho principal

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Reações armazenadas como `reactions: Record<Emoji, string[]>` em `RoomMessage` | Simples, incluído automaticamente no `room_snapshot` sem join extra | `StorageAdapter`, `InMemoryAdapter` e o tipo `RoomMessage` precisam ser atualizados; o campo é inicializado vazio na criação de cada mensagem |
| AD-2 | Estado em tempo real via WS: `add_reaction` / `remove_reaction` (client) → `reaction_added` / `reaction_removed` (server) | Consistente com o protocolo do projeto; HTTP routes mantidas apenas para compatibilidade, conforme PRD | Zustand store gerencia reações; `useReactions.ts` (axios + React Query) é removido |
| AD-3 | `ReactionBar/Picker/Button` revisados antes de integrar | Componentes existem mas não foram auditados contra os padrões do projeto (limite 120 linhas, padrão de props, etc.) | Pode gerar refatoração dos componentes antes da integração ao `MessageBubble` |
| AD-4 | Toggle é idempotente: add quando ausente, remove quando presente | Regra de negócio do PRD — uma reação por emoji por participante por mensagem | O handler WS aplica a mesma lógica que os routes HTTP já implementam |

## 4. Requisitos

- RF-1: O sistema deve permitir que um participante adicione ou remova um emoji (`👍 👎 😂 ❤️`) de qualquer mensagem da sala.
- RF-2: Adicionar a mesma reação novamente deve removê-la (toggle idempotente).
- RF-3: A mudança de reação deve ser propagada em tempo real via WS para todos os participantes da sala.
- RF-4: O `room_snapshot` deve incluir as reações agregadas de cada mensagem, para que novos participantes vejam o estado atual.
- RF-5: A contagem de reações por emoji deve ser exibida abaixo de cada mensagem no `MessageBubble`.
- RF-6: Mensagens do coach de IA (`role === 'assistant'`) não recebem reações — o `ReactionBar` não é renderizado para elas.
- RNF-1: Nenhum arquivo de frontend pode exceder 120 linhas (regra mandatória do PRD).
- RNF-2: `useReactions.ts` e os testes HTTP correspondentes são removidos — sem código morto.

## 5. Critérios de Aceite Globais

- [ ] Participante A clica em 👍 numa mensagem → Participante B vê a contagem atualizar em tempo real sem recarregar
- [ ] Clicar no mesmo emoji remove a reação (toggle); contagem volta a 0
- [ ] Entrar na sala depois de reações existirem mostra as contagens corretas (via `room_snapshot`)
- [ ] Mensagens do coach (`role === 'assistant'`) não exibem `ReactionBar`
- [ ] `useReactions.ts` não existe mais no repositório
- [ ] `npm run test` passa no backend e no frontend sem erros
- [ ] Nenhum arquivo de frontend adicionado ou modificado excede 120 linhas

## 6. Tasks

### Fase 1: Tracer Bullet — Backend wired E2E
> Entrega: o servidor aceita eventos WS de reação, persiste e rebroadcasta; testável com qualquer cliente WS

#### Task 1: Adicionar reactions ao modelo de dados + StorageAdapter + InMemoryAdapter

- **Prova:** a camada de storage suporta o contrato de reações antes de qualquer integração WS
- **Done-when:**
  - [ ] `RoomMessage` em `StorageAdapter.ts` tem campo `reactions: Record<string, string[]>` (chave = Emoji value, valor = array de `participantId`)
  - [ ] Interface `StorageAdapter` expõe `addReaction(roomId, messageId, participantId, emoji)` e `removeReaction(roomId, messageId, participantId, emoji)`, ambos retornam `RoomMessage | null`
  - [ ] `InMemoryAdapter` implementa os dois métodos com lógica de toggle (add quando ausente, remove quando presente)
  - [ ] Mensagens criadas por `SendMessage` inicializam `reactions: {}` 
- **Verificar:** `cd backend && npm run build` sem erros de tipo
- **Balizador:** Se `InMemoryAdapter` compila e os métodos aparecem no tipo, a camada de storage está pronta.

#### Task 1T: Testes — InMemoryAdapter reactions

- **Cobre:** `addReaction` e `removeReaction` no `InMemoryAdapter`
- **Done-when:**
  - [ ] Adicionar reação ausente: participantId aparece na lista do emoji
  - [ ] Adicionar reação já existente: participantId é removido (toggle)
  - [ ] Dois participantes com o mesmo emoji: ambos aparecem na lista
  - [ ] `removeReaction` em mensagem inexistente retorna `null`
  - [ ] `room_snapshot` retornado por `getRoom` inclui reações
- **Verificar:** `cd backend && npm run test -- --testPathPattern InMemoryAdapter`

#### Task 2: WS handler — eventos de reação + reactions no room_snapshot

- **Prova:** o ciclo completo server-side funciona: client event → storage → broadcast
- **Done-when:**
  - [ ] `ClientEvent` do backend aceita `{ type: 'add_reaction', messageId: string, emoji: string }` e `{ type: 'remove_reaction', messageId: string, emoji: string }` (validados com Zod)
  - [ ] Handler chama `storage.addReaction` / `storage.removeReaction` e faz broadcast de `reaction_added` / `reaction_removed` com shape `{ type, messageId, emoji, participantId, reactions: Record<string, string[]> }` para todos na sala
  - [ ] `room_snapshot` inclui `reactions` em cada mensagem (campo já vem do storage após Task 1)
  - [ ] Reação em mensagem de sala errada retorna evento `error`
- **Verificar:** `cd backend && npm run build && npm run test -- --testPathPattern handler`
- **Balizador:** Se o handler processa `add_reaction` e o broadcast aparece nos sockets dos outros, a fase 1 está completa.

---
**Checkpoint Fase 1:** `cd backend && npm run build && npm run test` — build limpo, todos os testes passando. Verificação manual: conectar dois clientes WS, enviar `add_reaction`, confirmar que ambos recebem `reaction_added`.

---

### Fase 2: Frontend — Protocolo + Estado
> Entrega: o frontend processa eventos WS de reação e reflete no Zustand; componentes de UI revisados e prontos

#### Task 3: WS protocol + Zustand store + WS client

- **Prova:** eventos de reação fluem do servidor até o estado Zustand no cliente
- **Done-when:**
  - [ ] `protocol.ts` (frontend) adiciona `add_reaction` e `remove_reaction` em `ClientEvent`; adiciona `reaction_added` e `reaction_removed` em `ServerEvent` com shape idêntico ao broadcast do backend
  - [ ] `RoomMessage` no protocolo tem campo `reactions: Record<string, string[]>`
  - [ ] Zustand `roomStore` trata `reaction_added` e `reaction_removed`: atualiza o campo `reactions` da mensagem correspondente sem substituir todo o array de mensagens
  - [ ] `ws/client.ts` despacha `reaction_added` / `reaction_removed` para a store (mesmo padrão dos demais eventos)
  - [ ] `room_snapshot` já popula `reactions` em cada mensagem na store (sem código extra se o campo estiver no tipo)
- **Verificar:** `cd frontend && npm run build` sem erros de tipo
- **Balizador:** Se a store tem `addReaction`/`removeReaction` actions e elas atualizam `messages[n].reactions`, o estado está wired.

#### Task 3T: Testes — roomStore reactions

- **Cobre:** actions `addReaction` e `removeReaction` na store Zustand
- **Done-when:**
  - [ ] `reaction_added`: contagem cresce corretamente na mensagem certa
  - [ ] `reaction_removed`: participantId some da lista; contagem decresce
  - [ ] Evento para messageId inexistente não lança erro (mensagem é ignorada)
  - [ ] Snapshot com reações preexistentes: mensagens chegam com `reactions` populado
- **Verificar:** `cd frontend && npm run test -- roomStore`

#### Task 4: Revisar e adaptar ReactionBar, ReactionPicker, ReactionButton

- **Prova:** componentes seguem os padrões do projeto e estão prontos para integração
- **Done-when:**
  - [ ] Cada componente ≤ 120 linhas (contagem com `wc -l`)
  - [ ] Props tipadas sem `any`; sem dependência de axios ou React Query
  - [ ] `ReactionBar` recebe `reactions: Record<string, string[]>`, `participantId: string`, `onAdd: (emoji) => void`, `onRemove: (emoji) => void` — sem side-effects internos
  - [ ] `ReactionPicker` e `ReactionButton` seguem o mesmo padrão de props simples
  - [ ] CSS/Tailwind separado da lógica (sem style objects inline extensos)
- **Verificar:** `cd frontend && npm run build` sem warnings; `wc -l frontend/src/components/ui/Reaction*.tsx` todos ≤ 120
- **Balizador:** Se os três componentes compilam e não importam axios/react-query, estão prontos.

---
**Checkpoint Fase 2:** `cd frontend && npm run build && npm run test` — build limpo, testes passando. Verificação: inspecionar store no devtools após receber evento `reaction_added` mockado.

---

### Fase 3: UI Wiring + Limpeza
> Entrega: feature completa e visível no chat; código legado removido

#### Task 5: Integrar ReactionBar no MessageBubble + despachar eventos WS

- **Prova:** o usuário vê e interage com reações no chat real
- **Done-when:**
  - [ ] `MessageBubble` renderiza `ReactionBar` abaixo do conteúdo da mensagem, passando `reactions` da store e `participantId` do estado local
  - [ ] Clique em emoji existente do participante → dispatch `remove_reaction` via WS client
  - [ ] Clique em emoji ausente (ou picker) → dispatch `add_reaction` via WS client
  - [ ] Mensagens com `role === 'assistant'` não renderizam `ReactionBar`
  - [ ] `MessageBubble` permanece ≤ 120 linhas após a adição
- **Verificar:** `cd frontend && npm run build`; abrir dois navegadores na mesma sala, clicar em emoji, confirmar contagem atualiza em tempo real no outro
- **Balizador:** Se a contagem muda no outro participante sem reload e não aparece em mensagens de IA, a integração está correta.

#### Task 5T: Testes — MessageBubble com reações

- **Cobre:** renderização condicional de `ReactionBar` e dispatch de eventos
- **Done-when:**
  - [ ] Mensagem de usuário com `reactions: { '👍': ['p1'] }`: `ReactionBar` renderiza com contagem 1
  - [ ] Mensagem com `role === 'assistant'`: `ReactionBar` não é renderizado
  - [ ] Clicar no emoji da própria reação dispara callback `onRemove`
  - [ ] Clicar em emoji sem reação prévia dispara callback `onAdd`
- **Verificar:** `cd frontend && npm run test -- MessageBubble`

#### Task 6: Remover useReactions.ts + limpar testes HTTP legados

- **Prova:** sem código morto nem dependências desnecessárias
- **Done-when:**
  - [ ] `frontend/src/hooks/useReactions.ts` deletado
  - [ ] `frontend/tests/reactions.test.tsx` deletado (testava axios; testes WS já cobrem o comportamento)
  - [ ] Nenhum import de `useReactions` remanescente (`grep -r useReactions frontend/src` retorna vazio)
  - [ ] Dependências React Query / axios-mock-adapter removidas do `package.json` se não usadas em outro lugar (verificar antes de remover)
  - [ ] `npm run test` no frontend passa sem referências quebradas
- **Verificar:** `cd frontend && grep -r useReactions src/ && npm run test`
- **Balizador:** Se o grep retorna vazio e os testes passam, a limpeza está completa.

---
**Checkpoint Fase 3:** `cd backend && npm run test` + `cd frontend && npm run test` — todos os testes passando. Verificação manual dos Critérios de Aceite Globais um a um. Nenhum arquivo novo/modificado excede 120 linhas.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `ReactionBar` ultrapassa 120 linhas e precisa de split | Média | Baixo | Task 4 audita antes de integrar; se necessário, extrai `ReactionPickerPopover` como componente separado |
| React Query / axios-mock-adapter usados em outros lugares além de reações | Baixa | Médio | Task 6 verifica `grep` antes de remover do `package.json` |
| Shape do `reactions` no snapshot incompatível com o tipo do frontend | Baixa | Médio | Task 3 unifica o tipo em `protocol.ts`; build valida na hora |
| Broadcast de `reaction_added` para sala errada vaza dados | Baixa | Alto | Handler valida `roomId` da mensagem antes de broadcast; Task 2 inclui teste para esse caso |

## 8. Perguntas em aberto

- [ ] Os endpoints HTTP de reação existentes (`GET/POST/DELETE /api/messages/:id/reactions`) devem ser mantidos como estão ou podem receber pequenos ajustes para retornar o novo shape `reactions: Record<Emoji, string[]>`? (PRD diz "mantidos para compatibilidade" — assumindo sem mudança de contrato)
