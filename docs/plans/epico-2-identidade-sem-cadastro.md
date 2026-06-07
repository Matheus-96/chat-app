# Plano: Épico 2 — Identidade sem Cadastro

> **Status:** Rascunho
> **Criado em:** 2026-06-06
> **Origem:** [docs/prd.md](../prd.md) — Épico 2

## 1. O que estamos construindo

Completar o modelo de identidade efêmera do produto: adicionar `customInstructions` ao perfil local (localStorage), migrar `agentMode` de localStorage para memória da store (Zustand), adicionar campo de instruções na landing page e criar um editor de perfil inline na sidebar. Ao final, o participante pode ajustar nome e instruções durante a sessão, e a mudança de nome propaga em tempo real para todos via WS.

## 2. Fora do escopo

- Validação de formato da API Key (apenas erros em runtime quando o coach falhar)
- `agentMode` toggle na sidebar (UI do toggle é escopo do Épico 6)
- O backend usar `customInstructions` para chamar a IA (escopo do Épico 5/7) — aqui apenas garantimos que o campo está presente no WS `send_message` e `analyze_message`
- Sincronização de `customInstructions` entre participantes (campo é privado e stateless)

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | `customInstructions` em `localStorage`, enviada como campo opcional em `send_message` e `analyze_message` — nunca armazenada no servidor | Alinha com o padrão já usado para `apiKey`; servidor é stateless em relação ao perfil | Backend recebe o campo mas o ignora até Épico 5/7 implementar o uso |
| AD-2 | `agentMode` sai do `localStorage` e passa a ser estado inicial fixo da Zustand store (`'manual'`) | PRD especifica "preferência persiste na sessão (memória, não localStorage)"; corrige dívida técnica | Breaking change: usuários com `agentMode` salvo perdem a preferência na próxima visita e padrão será `'manual'` |
| AD-3 | Mudança de nome na sidebar emite evento WS `update_name` (client→server); servidor atualiza storage e broadcast `participant_update` (server→client) com lista atualizada | Reutiliza o evento `participant_update` já existente no protocolo; `update_name` é o único evento novo | `StorageAdapter` recebe método `updateParticipantName`; `InMemoryAdapter` implementa |
| AD-4 | Editor de perfil extraído para `ProfileEditor.tsx` (componente separado) | `LandingPage.tsx` já tem 116 linhas; `Sidebar.tsx` tem 73; adicionar UI de edição em qualquer um dos dois ultrapassaria 120 linhas | `ProfileEditor` é usado em ambos os contextos (landing e sidebar) |

## 4. Requisitos

- RF-1: `participantId` gerado por aba do navegador via `crypto.randomUUID()` e persistido em `sessionStorage`; duas abas = dois participantes distintos
- RF-2: Nome livre, sem validação de unicidade
- RF-3: `name`, `apiKey` e `customInstructions` persistidos em `localStorage` e restaurados na próxima visita ao mesmo navegador
- RF-4: `agentMode` mantido somente em memória (store Zustand); padrão `'manual'`; reseta ao fechar/recarregar a aba
- RF-5: `customInstructions` com máximo de 250 caracteres; contador visível na UI; envio bloqueado se exceder
- RF-6: Editor de perfil acessível na landing (antes de entrar) e na sidebar (sem sair da sala)
- RF-7: Mudança de nome na sidebar propagada em tempo real para todos os participantes da sala via WS
- RF-8: Nenhum dado de identidade persiste no servidor — servidor conhece o participante apenas enquanto a WS está ativa
- RNF-1: Nenhum arquivo de frontend pode exceder 120 linhas (mandatório do PRD)

## 5. Critérios de Aceite Globais

- [ ] Ao entrar na landing em nova aba, `participantId` é gerado e persiste em `sessionStorage`; segunda aba gera `participantId` diferente
- [ ] Preencher e salvar nome + API Key + `customInstructions` na landing; recarregar a página → campos restaurados
- [ ] `agentMode` não aparece no `localStorage`; ao recarregar a aba, inicia em `'manual'`
- [ ] Campo `customInstructions` na landing: contador regressivo, envio bloqueado se > 250 chars
- [ ] Na sidebar: clicar em "Editar perfil" abre `ProfileEditor`; alterar nome e `customInstructions`; salvar persiste no `localStorage`
- [ ] Alterar nome na sidebar → outro participante (segunda aba ou outro navegador) vê o nome atualizado sem recarregar
- [ ] `tsc` sem erros em backend e frontend
- [ ] Todos os testes passam

## 6. Tasks

### Fase 1: Fundação — Storage, protocolo e landing (Tracer Bullet)
> Entrega: `customInstructions` existe no perfil local, é exibido e salvo na landing page; `agentMode` migrado para memória

#### Task 1: Extend profile storage + migrate agentMode + wire WS
- **Prova:** campo `customInstructions` flui de `localStorage` → landing form → WS payload; `agentMode` não toca mais o `localStorage`
- **Done-when:**
  - [ ] `shared/storage/profile.ts`: interface `StoredProfile` inclui `customInstructions: string`; `saveProfile` e `loadStoredProfile` lêem/escrevem o campo; `saveStoredAgentMode` e `loadStoredAgentMode` removidos
  - [ ] `store/roomStore.ts`: `agentMode: AgentMode` com default `'manual'` e ação `setAgentMode`; nenhuma referência a `localStorage` para agentMode
  - [ ] `features/chat/RoomPage.tsx`: lê `agentMode` da store em vez do perfil
  - [ ] `shared/ws/client.ts`: `sendMessage` inclui `customInstructions?: string`; `sendAnalyze` inclui `customInstructions?: string` (ambos lidos da store/prop passado pelo chamador)
  - [ ] Backend `send_message` e `analyze_message` schemas (Zod): adicionado `customInstructions: z.string().max(250).optional()`
- **Verificar:** `cd frontend && npx tsc --noEmit` e `cd backend && npx tsc --noEmit` sem erros; inspecionar `localStorage` no DevTools — chave de `agentMode` ausente
- **Balizador:** Se `profile.ts` não exporta mais nada relacionado a `agentMode` e `localStorage` não mostra a chave após login, está correto.

#### Task 1T: Testes — profile storage
- **Cobre:** módulo `shared/storage/profile.ts`
- **Done-when:**
  - [ ] `getParticipantId()` retorna UUID; chamadas subsequentes na mesma aba retornam o mesmo ID (sessionStorage persiste)
  - [ ] `saveProfile` + `loadStoredProfile` roundtrip: `name`, `apiKey`, `customInstructions` preservados
  - [ ] Backward compat: quando chave `customInstructions` ausente no localStorage, `loadStoredProfile` retorna `''`
  - [ ] Store Zustand: `setAgentMode` muda o estado; `agentMode` inicia em `'manual'`
- **Verificar:** `cd frontend && npm test -- --testPathPattern=profile`
- **Balizador:** Se 4+ assertions passam sem mock de localStorage, o módulo é testável de forma isolada.

#### Task 2: Landing — campo customInstructions
- **Prova:** usuário preenche instruções na landing, entra na sala, volta à landing → instruções restauradas
- **Done-when:**
  - [ ] `ProfileEditor.tsx` criado em `features/landing/components/` (ou `shared/components/`) com: input de nome, input de API Key, textarea de `customInstructions` (250 chars, contador regressivo, cor de alerta em ≤ 20 chars restantes), botão de submit desabilitado se > 250 chars
  - [ ] `LandingPage.tsx` usa `ProfileEditor` para o formulário de perfil; arquivo ≤ 120 linhas
  - [ ] Submissão chama `saveProfile({ name, apiKey, customInstructions })`
  - [ ] `ProfileEditor.tsx` ≤ 120 linhas
- **Verificar:** acessar `http://localhost:5173`, preencher todos os campos, submeter, recarregar → campos restaurados; tentar > 250 chars → botão desabilitado
- **Balizador:** Se o contador muda em tempo real e o botão trava acima de 250 chars, a Task está completa.

---
**Checkpoint Fase 1:** `tsc` limpo em backend e frontend + testes de profile passando + campo visível e funcional na landing.

---

### Fase 2: Edição de perfil em sala + propagação WS
> Entrega: participante edita nome/instruções na sidebar; outros participantes veem o novo nome em tempo real

#### Task 3: Sidebar — ProfileEditor inline
- **Prova:** usuário edita nome na sidebar sem sair da sala; localStorage é atualizado e store reflete o novo nome localmente
- **Done-when:**
  - [ ] `features/chat/components/ProfileEditor.tsx` criado (ou reutilizado da Fase 1 com adaptações): exibe nome atual e `customInstructions`; modo "edição" ao clicar em ícone de lápis; campos editáveis com contador; botões "Salvar" e "Cancelar"
  - [ ] Ao salvar: `saveProfile` persiste no localStorage; store atualiza nome local (`setParticipantName` ou equivalente)
  - [ ] `Sidebar.tsx` importa e renderiza `ProfileEditor`; arquivo ≤ 120 linhas
  - [ ] `ProfileEditor.tsx` ≤ 120 linhas
- **Verificar:** abrir sala, clicar em editar na sidebar, alterar nome, salvar → nome aparece atualizado na sidebar imediatamente
- **Balizador:** Se o nome muda na sidebar sem recarregar a página e o `localStorage` reflete o novo valor, está correto.

#### Task 4: Backend — evento update_name
- **Prova:** servidor recebe `update_name`, atualiza storage e faz broadcast `participant_update` com lista atualizada
- **Done-when:**
  - [ ] `StorageAdapter` interface: novo método `updateParticipantName(participantId: string, name: string): void`
  - [ ] `InMemoryAdapter`: implementa `updateParticipantName` — atualiza `participants` Map pelo `participantId`
  - [ ] `interface/ws/handler.ts`: schema e handler para `{ type: 'update_name', name: string }` — valida nome (min 1, max 32), busca o participante pelo socketId/participantId da sessão, chama `storage.updateParticipantName`, faz broadcast `participant_update` para todos na sala
- **Verificar:** via wscat ou Insomnia, conectar, fazer `join_room`, enviar `{ type: 'update_name', name: "Novo Nome" }` → broadcast `participant_update` com o participante atualizado
- **Balizador:** Se o broadcast `participant_update` chega para todos com o nome novo e o storage reflete a mudança, está correto.

#### Task 5: Frontend — sendUpdateName + participant_update na store
- **Prova:** alterar nome na sidebar propaga para todos os outros participantes conectados via WS
- **Done-when:**
  - [ ] `shared/ws/client.ts`: método `sendUpdateName(name: string)` que emite `{ type: 'update_name', name }`
  - [ ] `store/roomStore.ts`: handler de `participant_update` (server→client) atualiza nome do participante na lista `participants` da store
  - [ ] `features/chat/components/ProfileEditor.tsx` (no contexto da sidebar): ao salvar, se nome mudou, chama `wsClient.sendUpdateName(name)` além de persistir localmente
- **Verificar:** abrir sala em duas abas; na aba 1, editar nome na sidebar → aba 2 exibe nome atualizado na lista de participantes sem recarregar
- **Balizador:** Se o nome muda em tempo real na segunda aba após o save na primeira, a integração WS está completa.

#### Task 5T: Testes — update_name e participant_update
- **Cobre:** handler backend de `update_name`; reducer da store para `participant_update` com nome alterado
- **Done-when:**
  - [ ] Backend: teste unitário do fluxo `update_name` com `InMemoryAdapter` mock — verifica que `updateParticipantName` é chamado e broadcast `participant_update` é emitido
  - [ ] Frontend store: `applyParticipantUpdate` recebendo participante com nome alterado → `participants` da store reflete o novo nome
  - [ ] Ambos os casos de erro cobertos: `update_name` com nome vazio retorna evento `error`; `update_name` de participante não conectado é ignorado
- **Verificar:** `npm test` em backend e frontend — todos os testes passam
- **Balizador:** Se os testes cobrem o caminho feliz e o caso de nome inválido sem subir servidor WS real, estão bem escritos.

---
**Checkpoint Fase 2:** build limpo + todos os critérios de aceite globais atendidos + teste E2E manual do fluxo "editar nome → ver atualização na segunda aba".

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `ProfileEditor` reutilizável em landing e sidebar pode ter comportamentos distintos (submit vs. save inline) | Média | Médio | Aceitar props `onSave(profile)` e `showRoomCodeField` para adaptar contexto; testar os dois casos |
| Migração do `agentMode` quebra usuários com `localStorage` populado | Baixa | Baixo | Não há side-effect; chave obsoleta fica no localStorage sem leitura — não causa erro |
| `participant_update` já existente no protocolo pode ter shape diferente do esperado para nome | Baixa | Médio | Verificar shape atual antes de implementar Task 4; ajustar se necessário |

## 8. Perguntas em aberto

- [ ] O `ProfileEditor` deve ser um componente compartilhado em `shared/components/` ou duplicado em `features/landing/` e `features/chat/`? (Decide na Task 2 ao verificar o quanto o contexto difere)
