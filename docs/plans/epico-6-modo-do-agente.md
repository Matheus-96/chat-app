# Plano: Épico 6 — Modo do Agente

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** [PRD §Épico 6](../prd.md#épico-6--modo-do-agente)

## 1. O que estamos construindo

A funcionalidade core do modo do agente (toggle automático ↔ manual, Ctrl+Enter, botão "Analisar") foi entregue junto ao Épico 5. Este épico formaliza a cobertura de testes unitários dos comportamentos do modo, uma auditoria de UX para garantir consistência textual e de estados, e o teste E2E do fluxo manual completo.

## 2. Fora do escopo

- Novos eventos WebSocket ou use cases de backend — herança integral do Épico 5
- Persistência do modo por sala ou por conta — o modo é por participante, em localStorage
- Desabilitar/ocultar o toggle quando sem API Key — comportamento atual mantido (ver AD-2)

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | `agentMode` persiste em **localStorage**, não em memória de sessão | PRD especifica "memória, não localStorage", mas o usuário decidiu manter localStorage para conveniência | O modo sobrevive entre sessões no mesmo navegador; comportamento diferente do PRD §Épico 6 |
| AD-2 | Toggle visível e funcional mesmo sem API Key | Usuário optou por não desabilitar/ocultar o toggle; sem API Key o coach nunca dispara de qualquer forma | Sem alteração de UI necessária; simplifica o épico |
| AD-3 | Nenhum novo use case ou evento WS | Toda a lógica de negócio foi entregue no Épico 5 (`shouldAnalyze` em `handler.ts:164`, `AnalyzeMessage`, `set_agent_mode`) | O épico é inteiramente de qualidade: testes + UX |
| AD-4 | Teste E2E usa **`MockAIProvider`** injetado via variável de ambiente | API Key real torna o E2E frágil (rate limit, custo, latência); mock garante resposta determinística e roda em CI sem segredos | O backend precisa de um modo de teste (`AI_PROVIDER=mock`) que substitua `OpenRouterProvider` por `MockAIProvider` na composição root |

## 4. Requisitos

- RF-1: Em modo automático, toda mensagem enviada com API Key dispara análise imediatamente.
- RF-2: Em modo manual, o envio não dispara análise; o usuário clica "Analisar" no balão ou usa Ctrl+Enter.
- RF-3: O modo é por participante; a preferência persiste em localStorage.
- RF-4: O toggle fica na sidebar e é acessível sem sair da sala.
- RF-5: Sem API Key, o coach não dispara em nenhum modo (toggle não tem efeito prático).
- RNF-1: Nenhum arquivo de frontend ultrapassa 120 linhas.
- RNF-2: Todos os testes unitários passam com `npm test` no diretório `frontend/`.

## 5. Critérios de Aceite Globais

- [ ] Modo automático: enviar mensagem → análise dispara sem ação adicional
- [ ] Modo manual: enviar mensagem → análise não dispara; botão "Analisar" aparece no balão
- [ ] Ctrl+Enter em modo manual envia com análise; Enter envia sem análise
- [ ] Toggle persiste após reload da página (localStorage)
- [ ] Testes unitários de Store, Composer e MessageBubble passando sem erros
- [ ] Teste E2E do fluxo manual passando no Playwright
- [ ] Build sem erros de TypeScript

## 6. Tasks

### Fase 1: Cobertura e polimento
> Entrega: testes unitários completos para os comportamentos do modo do agente + UX auditada e ajustada

#### Task 1: Auditoria e ajustes de UX
- **Prova:** Os textos e estados da UI estão alinhados com o comportamento real do sistema
- **Arquivos:** `Sidebar.tsx`, `Composer.tsx`, `MessageBubble.tsx`
- **Done-when:**
  - [ ] Hint do Composer em modo manual é claro: indica Ctrl+Enter para enviar com análise
  - [ ] Hint do Composer em modo automático indica que análise é automática
  - [ ] Aviso "Coach desabilitado" na Sidebar aparece quando `apiKey` está vazia
  - [ ] Botão "Analisar com agente" no MessageBubble só aparece quando `canAnalyze=true`
  - [ ] Labels do toggle ("Automático" / "Manual") em português sem abreviações
- **Verificar:** Inspecionar visualmente cada estado no browser com e sem API Key em cada modo
- **Balizador:** Trocar de modo na sidebar → Composer muda o hint imediatamente; enviar mensagem → comportamento correto em cada modo.

#### Task 2T: Testes — Store (`setAgentMode` + `pendingCorrections`)
- **Cobre:** `roomStore.ts` — ações `setAgentMode`, `addPendingCorrection`, `removePendingCorrection`
- **Arquivo de teste:** `src/store/__tests__/roomStore.test.ts`
- **Done-when:**
  - [ ] `setAgentMode('manual')` → estado do store é `'manual'`
  - [ ] `setAgentMode('automatic')` → estado do store é `'automatic'`
  - [ ] `applySnapshot` com participante em modo `'manual'` → `agentMode` do store é `'manual'`
  - [ ] `addPendingCorrection('msg1')` → `pendingCorrections` contém `'msg1'`
  - [ ] `removePendingCorrection('msg1')` → `pendingCorrections` não contém `'msg1'`
  - [ ] `addMessage` com `replyToMessageId` remove do `pendingCorrections` (já coberto — verificar que passa)
- **Verificar:** `cd frontend && npm test -- --reporter=verbose src/store/__tests__/roomStore.test.ts`

#### Task 3T: Testes — Composer (modos e Ctrl+Enter)
- **Cobre:** `Composer.tsx` — comportamento de envio e hint texts por modo
- **Arquivo de teste:** `src/features/chat/components/__tests__/Composer.test.tsx`
- **Done-when:**
  - [ ] Modo `'manual'` + Enter → `onSend` chamado com `analyze=undefined` (ou `false`)
  - [ ] Modo `'manual'` + Ctrl+Enter → `onSend` chamado com `analyze=true`
  - [ ] Modo `'automatic'` + Enter → `onSend` chamado (análise controlada pelo backend)
  - [ ] Hint text muda conforme o modo: modo manual exibe referência ao Ctrl+Enter
  - [ ] Casos de API Key ausente (bloqueio) já cobertos — verificar que passam
- **Verificar:** `cd frontend && npm test -- --reporter=verbose src/features/chat/components/__tests__/Composer.test.tsx`

#### Task 4T: Testes — MessageBubble (`canAnalyze` e `isPending`)
- **Cobre:** `MessageBubble.tsx` — visibilidade do botão "Analisar" e estado de pendência
- **Arquivo de teste:** `src/features/chat/components/__tests__/MessageBubble.test.tsx`
- **Done-when:**
  - [ ] `canAnalyze=true` → botão "Analisar com agente" visível
  - [ ] `canAnalyze=false` → botão "Analisar com agente" ausente
  - [ ] `isPending=true` → indicador "Coach analisando..." visível
  - [ ] `isPending=false` sem correção → nenhum indicador de pendência
  - [ ] Casos de erro e sucesso (error, CorrectionBlock) já cobertos — verificar que passam
- **Verificar:** `cd frontend && npm test -- --reporter=verbose src/features/chat/components/__tests__/MessageBubble.test.tsx`

---
**Checkpoint Fase 1:** `cd frontend && npm test` passa sem erros + inspeção manual dos hints de modo no browser.

---

### Fase 2: Verificação ponta a ponta
> Entrega: fluxo completo do modo manual coberto por teste E2E automatizado

#### Task 5: Setup Playwright + teste E2E — fluxo modo manual
- **Prova:** O fluxo modo manual funciona E2E: envio sem análise → botão aparece → análise disparada → correção exibida
- **Done-when:**
  - [ ] `MockAIProvider` implementado em `backend/src/infrastructure/ai/MockAIProvider.ts` (retorna resposta fixa, sem chamada HTTP)
  - [ ] `server.ts` injeta `MockAIProvider` quando `AI_PROVIDER=mock` (variável de ambiente)
  - [ ] Arquivo `.env.test` criado na raiz do backend com `AI_PROVIDER=mock`
  - [ ] Playwright instalado e configurado em `frontend/` (ou raiz do projeto)
  - [ ] Arquivo `e2e/agent-mode-manual.spec.ts` criado
  - [ ] Teste sobe o backend com `AI_PROVIDER=mock` e o frontend antes de executar
  - [ ] Teste cobre: criar sala → entrar em modo manual → enviar mensagem → confirmar que análise NÃO dispara automaticamente → clicar "Analisar com agente" → ver resposta mock do coach aparecer
  - [ ] Teste passa de forma determinística (sem dependência de rede ou chave real)
- **Verificar:** `cd frontend && npx playwright test e2e/agent-mode-manual.spec.ts`
- **Balizador:** O teste falha se a análise disparar automaticamente em modo manual, ou se o botão "Analisar com agente" não aparecer após o envio.

---
**Checkpoint Fase 2:** todos os critérios de aceite globais atendidos; `npm test` + Playwright passando.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Playwright requer setup de browser binaries | Médio | Baixo | `npx playwright install` resolve; documentar no README |
| `MockAIProvider` precisa respeitar a interface `AIProvider` exatamente | Baixo | Baixo | Implementar a mesma assinatura de `analyze()` — trivial, retorna `WritingFeedback` fixo |
| Ctrl+Enter no Composer pode não ser capturável via Testing Library | Baixo | Baixo | Usar `userEvent.keyboard('{Control>}{Enter}{/Control}')` do `@testing-library/user-event` |

## 8. Perguntas em aberto

Nenhuma.
