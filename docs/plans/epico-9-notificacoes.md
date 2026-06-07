# Plano: Épico 9 — Notificações

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** [PRD §Épico 9](../prd.md#épico-9----notificações)

## 1. O que estamos construindo

A infraestrutura de notificações do épico 9 já existe e está funcional: `shared/notifications.ts` implementa `requestNotificationPermission`, `notifyNewMessage` e `playNotificationTone`; e `RoomPage.tsx` solicita permissão no mount.

Há porém um desvio do PRD: a lógica de filtro (`authorId !== participantId && role !== 'assistant'`) está em `client.ts`, dentro do dispatch WS, quando o PRD determina que deve ser encapsulada em `shared/notifications.ts`. O plano corrige esse desvio primeiro — movendo o filtro para uma função `maybeNotifyMessage` em `notifications.ts` — e em seguida cobre o comportamento com testes unitários e E2E.

## 2. Fora do escopo

- UI de feedback para permissão negada (`Notification.permission === 'denied'`) — não está no PRD
- Notificações para eventos que não sejam `message_created` (reações, correções de IA)
- Configuração de preferências de notificação pelo usuário
- Notificações push (service worker / backend)

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Stubs de `AudioContext` e `Notification` centralizados em `test-setup.ts` | Evita duplicação em cada suite; padrão usado pelo projeto para `@testing-library/jest-dom` | Todo arquivo de teste herda os stubs automaticamente via Vitest `setupFiles` |
| AD-2 | E2E injeta stub de `window.Notification` via `page.addInitScript` + `grantPermissions` | `addInitScript` roda antes de qualquer JS da página, garantindo que o stub exista quando o WS client despachar | O teste não depende de notificações nativas do OS — verifica apenas que o código de disparo foi executado corretamente |
| AD-3 | Extrair `maybeNotifyMessage(message, currentParticipantId)` para `notifications.ts` | O PRD define explicitamente: "Lógica de filtro encapsulada em `shared/notifications.ts`". Com isso `client.ts` fica responsável apenas por transporte — não por regras de negócio de notificação | `client.ts` passa a delegar a decisão inteiramente; `hasSnapshot` permanece em `client.ts` por ser estado de transporte, não de negócio |

## 4. Requisitos

- RF-1: O sistema deve disparar notificação sonora e de browser ao receber `message_created` de outro participante com `role !== 'assistant'`, quando há snapshot.
- RF-2: O sistema NÃO deve disparar notificação para mensagens do próprio participante.
- RF-3: O sistema NÃO deve disparar notificação para mensagens com `role === 'assistant'`.
- RF-4: O sistema NÃO deve disparar notificação antes de receber o `room_snapshot`.
- RF-5: `notifyNewMessage` só deve criar `Notification` se `document.hidden === true` e `Notification.permission === 'granted'`.
- RF-6: `playNotificationTone` deve silenciar sem erro se `AudioContext` não estiver disponível.
- RF-7: `requestNotificationPermission` deve solicitar permissão apenas se o estado atual for `'default'`.
- RF-8: A permissão de notificação deve ser solicitada ao entrar na sala (mount do `RoomPage`).

## 5. Critérios de Aceite Globais

- [ ] `npx vitest run` passa sem erros no frontend
- [ ] `npx playwright test` passa (incluindo o novo spec de notificações)
- [ ] Nenhum `console.error` relacionado a `AudioContext` ou `Notification` nos testes

## 6. Tasks

### Fase 1: Refactor + Testes Unitários
> Entrega: filtro de notificação no lugar correto (`notifications.ts`) e comportamento coberto com testes unitários.

#### Task 1: Extrair `maybeNotifyMessage` para `notifications.ts` e simplificar `client.ts`

- **Prova:** Valida que `client.ts` não contém mais lógica de negócio de notificação — a decisão de notificar ou não vive inteiramente em `notifications.ts`.
- **Done-when:**
  - [ ] `notifications.ts` exporta `maybeNotifyMessage(message: { authorId: string; role: string; authorName: string; content: string }, currentParticipantId: string): void`
  - [ ] `maybeNotifyMessage` retorna sem efeito se `message.authorId === currentParticipantId` ou `message.role === 'assistant'`; caso contrário chama `playNotificationTone()` e `notifyNewMessage()`
  - [ ] `client.ts` importa `maybeNotifyMessage` e o bloco `message_created` passa a ser: `store.addMessage(event.message); if (hasSnapshot) maybeNotifyMessage(event.message, args.participantId)`
  - [ ] Nenhuma referência às regras `authorId !==` ou `role !== 'assistant'` permanece em `client.ts`
  - [ ] `npx tsc --noEmit` sem erros
- **Verificar:** `cd frontend && npx tsc --noEmit && grep -n "authorId\|role.*assistant" src/shared/ws/client.ts`
- **Balizador:** Se o grep retornar vazio, o filtro foi removido de `client.ts`.

---

#### Task 2: Stubs de APIs nativas no `test-setup.ts`

- **Prova:** Vitest consegue importar e executar `notifications.ts` sem `ReferenceError: AudioContext is not defined`.
- **Done-when:**
  - [ ] `test-setup.ts` declara stub de `window.AudioContext` com `createOscillator`, `createGain` e `destination` mockados via `vi.stubGlobal`
  - [ ] `test-setup.ts` declara stub de `window.Notification` com `permission`, `requestPermission` e construtor mockados
  - [ ] `npx vitest run` não lança `ReferenceError` relacionado a essas APIs
- **Verificar:** `cd frontend && npx vitest run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|ReferenceError)"`
- **Balizador:** Se o output não contiver `ReferenceError: AudioContext` nem `ReferenceError: Notification`, os stubs estão corretos.

---

#### Task 3: Testes de `shared/notifications.ts`

- **Cobre:** As quatro funções exportadas por `notifications.ts` após o refactor — `requestNotificationPermission`, `notifyNewMessage`, `playNotificationTone` e `maybeNotifyMessage`.
- **Done-when:**
  - [ ] `requestNotificationPermission`: skip se `Notification` ausente, skip se permission `'granted'` ou `'denied'`, chama `requestPermission()` se `'default'`
  - [ ] `notifyNewMessage`: skip se `document.hidden === false`, skip se `Notification` ausente, skip se `permission !== 'granted'`, cria `new Notification(title, { body })` quando condições satisfeitas
  - [ ] `playNotificationTone`: retorno silencioso se `AudioContext` ausente; configura oscillator com `type='triangle'`, `frequency=660`, `gain=0.025` se disponível
  - [ ] `maybeNotifyMessage`: não chama nada se `authorId === currentParticipantId`; não chama nada se `role === 'assistant'`; chama `playNotificationTone` e `notifyNewMessage` para mensagem de outro participante não-assistant
  - [ ] Arquivo em `frontend/src/shared/__tests__/notifications.test.ts`
- **Verificar:** `cd frontend && npx vitest run src/shared/__tests__/notifications.test.ts --reporter=verbose`
- **Balizador:** Se todos os casos passam, o contrato completo de `notifications.ts` está documentado.

---

#### Task 4: Testes de dispatch em `client.test.ts`

- **Cobre:** Que `client.ts` delega corretamente para `maybeNotifyMessage` — guardado pelo `hasSnapshot`.
- **Done-when:**
  - [ ] Novo `describe('notification dispatch')` em `client.test.ts`
  - [ ] `vi.mock('../../notifications')` já existe no arquivo — adicionar `maybeNotifyMessage` ao mock
  - [ ] Caso: `message_created` após snapshot → `maybeNotifyMessage` chamado com `(message, participantId)`
  - [ ] Caso: `message_created` antes do `room_snapshot` → `maybeNotifyMessage` NÃO chamado
- **Verificar:** `cd frontend && npx vitest run src/shared/ws/__tests__/client.test.ts --reporter=verbose`
- **Balizador:** Se os 2 casos passam, `client.ts` está correto: delega a decisão e respeita o guard de snapshot.

---

**Checkpoint Fase 1:** `npx vitest run` verde + revisão manual dos casos cobertos.

---

### Fase 2: Teste E2E
> Entrega: fluxo completo de notificação verificado end-to-end — mensagem de outro participante dispara o stub de `Notification`, mensagem própria não dispara.

#### Task 5: Spec E2E `notifications.spec.ts`

- **Prova:** O código de disparo de `Notification` é alcançado no fluxo real de chat entre dois participantes.
- **Done-when:**
  - [ ] Arquivo `frontend/e2e/notifications.spec.ts` criado
  - [ ] `page.context().grantPermissions(['notifications'])` concede permissão antes de navegar
  - [ ] `page.addInitScript` injeta stub de `window.Notification` que armazena chamadas em `window.__notifyCalls`
  - [ ] `document.hidden` é redefinido para `true` via `page.evaluate` após o snapshot ser recebido
  - [ ] Segundo participante (`page2`) envia mensagem na mesma sala
  - [ ] Após a mensagem chegar na `page1`, `page.evaluate(() => window.__notifyCalls)` retorna array com 1 entrada com `title === nome_do_segundo_participante`
  - [ ] Caso negativo: mensagem enviada pela `page1` para si mesma não incrementa `__notifyCalls`
- **Verificar:** `cd frontend && npx playwright test e2e/notifications.spec.ts --reporter=list`
- **Balizador:** Se o spec passa com 2 testes (positivo + negativo), o fluxo E2E está validado.

---

**Checkpoint Fase 2:** `npx playwright test` verde + `npx vitest run` verde = épico 9 concluído.

> **Ordem mandatória:** Task 1 (refactor) deve ser concluída antes das Tasks 2–4. Os testes testam a versão refatorada, não a atual.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `AudioContext` stub incompleto (faltam métodos encadeados) | Média | Baixo | Criar stub com `createOscillator` retornando objeto com `connect`, `start`, `stop`; `createGain` retornando objeto com `gain.value` e `connect` |
| `document.hidden` não é redefinível em alguns ambientes de teste | Baixa | Médio | Usar `Object.defineProperty(document, 'hidden', { value: true, configurable: true, writable: true })` |
| Race condition no E2E: mensagem chega antes do stub estar registrado | Baixa | Alto | `addInitScript` garante que o stub existe antes de qualquer JS da página; aguardar `.message-bubble` antes de verificar `__notifyCalls` |
| Segundo participante no Playwright exige contexto de browser isolado | Baixa | Baixo | Usar `browser.newContext()` + `context.newPage()` — padrão já adotado em outros specs do projeto |

## 8. Perguntas em aberto

- (nenhuma — todas as ramificações foram resolvidas na entrevista)
