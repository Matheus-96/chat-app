# Plano: Épico 7 — Custom Instructions do Coach

> **Status:** Concluído
> **Criado em:** 2026-06-07
> **Origem:** [PRD §Épico 7](../prd.md)

## 1. O que estamos construindo

O campo de custom instructions, sua persistência em localStorage, a passagem via protocolo WS e a injeção no prompt do OpenRouterProvider já foram implementados durante o épico 5. O épico 7 fecha os gaps restantes: sanitização do input no backend antes de chegar ao prompt, bloqueio de envio no Composer quando o campo excede 250 caracteres, e cobertura de testes para esses dois fluxos.

## 2. Fora do escopo

- Histórico ou gerenciamento de múltiplas instruções salvas
- Instruções por sala (a preferência é por participante)
- Feedback visual indicando que instruções estão ativas (badge, ícone)
- A/B testing ou analytics de efetividade das instruções

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Trim acontece no `OpenRouterProvider.analyze()`, antes de compor o prompt | É a última camada antes do dado entrar no prompt — garante que mesmo inputs vindos de caminhos alternativos sejam sanitizados | Nenhuma outra camada precisa fazer trim; o use case `AnalyzeMessage` não muda |
| AD-2 | Composer recebe `customInstructionsValid: boolean` como prop — não acessa store diretamente | Segue o padrão já adotado: Composer é presentational, quem controla a lógica é `RoomPage` | `RoomPage` precisa calcular `customInstructionsValid` e passar para Composer |
| AD-3 | "Válido" significa `customInstructions.length <= 250` (string vazia é válida) | Instrução vazia significa "sem instrução" — não deve bloquear envio | Bloqueio só ativa quando o usuário digita mais de 250 chars sem salvar/apagar |

## 4. Requisitos

- RF-1: O sistema deve fazer `trim()` em `customInstructions` antes de injetar no prompt do LLM.
- RF-2: O Composer deve desabilitar o botão de envio quando `customInstructions.length > 250`.
- RF-3: O WS handler do backend deve rejeitar `send_message` e `analyze_message` com `customInstructions` acima de 250 chars, retornando evento `error` ao cliente (validação Zod já existe — precisa ser verificada e testada).
- RF-4: O AnalyzeMessage use case deve continuar recebendo e passando `customInstructions` inalterado; o trim é responsabilidade do provider.
- RNF-1: Nenhum arquivo de frontend pode exceder 120 linhas (regra mandatória do PRD).

## 5. Critérios de Aceite Globais

- [ ] Digitar 251+ chars no campo e tentar enviar uma mensagem: botão de envio permanece desabilitado (frontend).
- [ ] Se um cliente enviar `customInstructions` com 251+ chars via WS (bypass do frontend), o servidor retorna evento `error` ao remetente.
- [ ] Digitar uma instrução válida (≤ 250 chars com espaços extras), enviar mensagem: o prompt enviado ao OpenRouter contém a instrução com trim aplicado.
- [ ] `AnalyzeMessage.test.ts` cobre: customInstructions é passado ao `aiProvider.analyze()`; trim não é responsabilidade do use case (o provider recebe o valor bruto).
- [ ] `handler.test.ts` (ou equivalente) cobre: customInstructions > 250 chars retorna evento `error`.
- [ ] `Composer.test.tsx` cobre: botão desabilitado quando `customInstructionsValid=false`.
- [ ] Build sem erros de TypeScript, todos os testes passando.

## 6. Tasks

### Fase 1: Gaps de comportamento
> Entrega: sanitização no backend funcionando + Composer bloqueando envio com instrução inválida.

#### Task 1: Backend — trim em `OpenRouterProvider.analyze()`
- **Prova:** valida que o dado chega ao prompt sem whitespace desnecessário independentemente do que o cliente enviou.
- **Done-when:**
  - [ ] `customInstructions` recebe `.trim()` antes de ser interpolado no user message
  - [ ] String vazia após trim não injeta a linha `Custom instructions: ...` no prompt
  - [ ] Arquivo `OpenRouterProvider.ts` permanece sem erros TypeScript
- **Verificar:** `cd backend && npx tsc --noEmit`
- **Balizador:** Se `"  focus on prepositions  "` virar `"focus on prepositions"` no prompt enviado, está no caminho certo.

#### Task 2: Frontend — Composer bloqueia quando `customInstructions` inválido
- **Prova:** a constraint de 250 chars é enforçada no ponto de envio, não apenas no campo de texto.
- **Done-when:**
  - [ ] `RoomPage` calcula `customInstructionsValid = customInstructions.length <= 250` e passa ao `Composer`
  - [ ] `Composer` recebe prop `customInstructionsValid: boolean` e a incorpora na condição `disabled` do botão de envio
  - [ ] A prop `disabled` do Composer (que já existe) incorpora `!customInstructionsValid` sem remover as condições existentes (`!hasApiKey`, status de conexão)
  - [ ] Arquivos `Composer.tsx` e `RoomPage.tsx` permanecem abaixo de 120 linhas
- **Verificar:** `cd frontend && npx tsc --noEmit`
- **Balizador:** Se o botão ficar desabilitado ao ultrapassar 250 chars no campo de instruções (sem recarregar), está no caminho certo.

---
**Checkpoint Fase 1:** `npx tsc --noEmit` limpo em frontend e backend + verificação manual: digitar 251 chars no campo → botão desabilitado; enviar mensagem com instrução com espaços → prompt no log do servidor mostra trim.

---

### Fase 2: Testes
> Entrega: cobertura explícita dos dois comportamentos introduzidos na fase 1.

#### Task 3T: Testes — validação backend e passagem de `customInstructions`
- **Cobre:** (a) WS handler rejeita customInstructions > 250; (b) use case passa valor bruto ao AIProvider.
- **Done-when:**
  - [ ] Caso WS: `customInstructions` com 251 chars → handler emite evento `error` ao remetente sem chamar o use case
  - [ ] Caso use case: `customInstructions` definido → `aiProvider.analyze()` é chamado com o valor exato recebido (sem trim)
  - [ ] Caso use case: `customInstructions` undefined → `aiProvider.analyze()` é chamado com `undefined`
  - [ ] Testes existentes de error handling continuam passando
- **Verificar:** `cd backend && npx jest --testPathPattern="AnalyzeMessage|handler"`
- **Balizador:** Se os três novos casos passarem sem alterar os mocks existentes, está correto.

#### Task 4T: Testes — `Composer` bloqueado com instrução inválida
- **Cobre:** a prop `customInstructionsValid` desabilitando o botão de envio.
- **Done-when:**
  - [ ] Caso: `customInstructionsValid=false` → botão de envio está `disabled` no DOM
  - [ ] Caso: `customInstructionsValid=true` + outros requisitos atendidos → botão habilitado
  - [ ] Testes existentes do Composer (typing, Ctrl+Enter, apiKey) continuam passando
- **Verificar:** `cd frontend && npx vitest run --reporter=verbose Composer`
- **Balizador:** Se os dois novos casos passarem sem modificar fixtures existentes, está correto.

---
**Checkpoint Fase 2:** `cd backend && npx jest` + `cd frontend && npx vitest run` — todos os testes passando; critérios de aceite globais atendidos.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `Composer.tsx` ultrapassar 120 linhas ao adicionar prop | Baixa | Médio | Verificar contagem antes de commitar; extrair lógica para `RoomPage` se necessário |
| Trim em `OpenRouterProvider` remover conteúdo legítimo (ex: instruções com newlines intencionais) | Baixa | Baixo | Usar apenas `.trim()` (não replace de whitespace interno) |

## 8. Perguntas em aberto

- (nenhuma — escopo fechado)
