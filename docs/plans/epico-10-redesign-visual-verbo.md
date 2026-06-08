# Plano: Redesign Visual — Layout Verbo

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** [Issue #3](https://github.com/Matheus-96/chat-app/issues/3) · PRD em `docs/plans/epico-10-redesign-visual-verbo-prd.md`

## 1. O que estamos construindo

Redesenho completo do `RoomPage` para seguir o visual de referência "Verbo.": nav esquerdo estreito com logo e item de sala, header fixo com título de participantes e gear button que abre um settings drawer à direita, bolhas de mensagem com avatares de iniciais e alinhamento por autor, e painel de correção rico com diff character-level, bloco ANTES/DEPOIS e botão "Entendi" que recolhe o painel localmente. A identidade visual existente (paleta laranja + fundo escuro) é mantida; a única adição é o token teal para o painel de correção.

## 2. Fora do escopo

- Redesign da `LandingPage`
- Suporte a múltiplas salas no nav esquerdo
- Botão "Copiar correção"
- Tema claro
- Responsividade mobile do settings drawer

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Single-room: nav exibe apenas a sala atual | Multi-room exige mudanças de backend fora do escopo | Nav esquerdo não é uma lista navegável; é decorativo/contextual |
| AD-2 | Settings drawer é overlay (`position: fixed`), não empurra o layout | Mantém a área de chat em largura total | Drawer fecha ao clicar fora; estado local em `RoomPage` |
| AD-3 | Diff character-level via `diff-match-patch` | Correções gramaticais mudam partes de palavras; word-diff perderia granularidade | Nova dependência no bundle do frontend |
| AD-4 | Dismissal do painel de correção é estado local (`useState` em `MessageBubble`) | Não há valor em persistir "Entendi" no servidor | Ao recarregar a página o painel reaparece |
| AD-5 | Avatar de sala = primeiros 2 chars do `roomCode` | Dado sempre disponível, sem campo adicional | Avatar pode ser "VE" para "VERB0-7K2P" — aceitável |

## 4. Requisitos

- **RF-1:** Nav esquerdo exibe logo "Verbo." e item de sala com avatar (2 primeiras letras do roomCode)
- **RF-2:** Header exibe nomes dos participantes como título (fallback: roomCode), avatares de iniciais, chip `# roomCode` e gear button
- **RF-3:** Clicar no gear button abre/fecha o settings drawer à direita
- **RF-4:** Settings drawer contém todos os controles do `Sidebar` atual (modo do agente, instruções, participantes, informações)
- **RF-5:** Mensagens de outros participantes aparecem à esquerda com avatar de iniciais; mensagens próprias à direita sem avatar
- **RF-6:** `CorrectionBlock` exibe badge "CORREÇÃO", texto corrigido com tokens alterados marcados, seção ANTES/DEPOIS, explicação e botão "Entendi"
- **RF-7:** Clicar "Entendi" recolhe o painel de correção (estado local)
- **RF-8:** `MessageList` exibe separadores de data (HOJE / ONTEM / data) entre grupos de mensagens
- **RF-9:** Indicador de digitação é uma bolha animada com três pontos pulsantes
- **RF-10:** Chip "Correção da IA ativada" visível em `MessageList` quando `agentMode === 'automatic'`
- **RNF-1:** Build TypeScript sem erros
- **RNF-2:** Todos os testes existentes passando sem regressão

## 5. Critérios de Aceite Globais

- [ ] Nav esquerdo com "Verbo." e avatar da sala visíveis em `RoomPage`
- [ ] Header mostra nomes de participantes (ou roomCode), chip de código e gear button
- [ ] Clicar no gear abre o drawer; clicar fora ou no gear novamente fecha
- [ ] Drawer contém todos os controles que hoje estão no Sidebar
- [ ] Mensagens alinhadas por autor; mensagens alheias têm avatar de iniciais
- [ ] Painel de correção completo: badge, diff highlight, ANTES/DEPOIS, explicação, "Entendi"
- [ ] Clicar "Entendi" colapsa o painel na mesma sessão
- [ ] Separadores de data aparecem entre dias diferentes
- [ ] Indicador de digitação é bolha animada (não texto puro)
- [ ] Chip "Correção da IA ativada" aparece no modo automático
- [ ] `pnpm test` passa sem regressão; `pnpm build` sem erros

## 6. Tasks

### Fase 1: Tracer Bullet — Estrutura e Navegação
> Entrega: novo layout de 3 colunas visível no browser com nav, header e settings drawer funcionais; Sidebar atual ainda renderiza dentro do drawer.

#### Task 1: Layout de 3 colunas + nav esquerdo
- **Prova:** valida que `RoomPage` suporta a nova grid sem quebrar o fluxo de chat
- **Done-when:**
  - [ ] `RoomPage` renderiza com coluna de nav esquerdo estreito (~72 px), área de chat central e slot para drawer
  - [ ] Nav exibe logo "Verbo." e item de sala com avatar de 2 letras derivado do `roomCode`
  - [ ] Layout responsivo existente (≤ 900 px) não quebra
- **Verificar:** abrir `http://localhost:5173/<roomCode>` e confirmar as três regiões visíveis
- **Balizador:** se o logo e o avatar da sala aparecem à esquerda e o chat ocupa o restante, está no caminho certo.

#### Task 2: Componente `Header`
- **Prova:** valida que o header recebe dados reativos de `RoomPage` e chama o callback correto
- **Done-when:**
  - [ ] `Header` renderiza com título = nomes dos participantes concatenados (fallback: roomCode)
  - [ ] Avatares de iniciais dos participantes visíveis no header
  - [ ] Chip `# roomCode` visível
  - [ ] Gear button presente e acessível (`aria-label="Configurações"`)
  - [ ] Clicar no gear chama `onSettingsToggle`
- **Verificar:** clicar no gear e checar que o estado muda em `RoomPage`
- **Balizador:** se o título muda quando um novo participante entra, a reatividade está correta.

#### Task 2T: Testes — `Header`
- **Cobre:** componente `Header` introduzido na Task 2
- **Done-when:**
  - [ ] Renderiza nomes dos participantes quando `participants.length > 0`
  - [ ] Renderiza `roomCode` como fallback quando `participants` está vazio
  - [ ] Chip com roomCode presente no DOM
  - [ ] `onSettingsToggle` chamado ao clicar no gear button
- **Verificar:** `pnpm test --run`

#### Task 3: `SettingsPanel` + drawer em `RoomPage`
- **Prova:** valida que os controles do Sidebar são acessíveis via drawer sem regressão funcional
- **Done-when:**
  - [ ] `Sidebar` renomeado/extraído para `SettingsPanel` com a mesma interface de props
  - [ ] Drawer renderiza `SettingsPanel` quando `settingsOpen === true` em `RoomPage`
  - [ ] Clicar fora do drawer fecha (overlay backdrop com `onClick`)
  - [ ] Todas as funcionalidades do Sidebar original (modo agente, instruções, participantes, info) operacionais dentro do drawer
- **Verificar:** alternar modo do agente dentro do drawer e confirmar que mensagens reagem ao novo modo
- **Balizador:** se `pnpm test` passa sem tocar nos testes de Composer, o contrato de props foi preservado.

---
**Checkpoint Fase 1:** build limpo · layout de 3 colunas no browser · drawer abre e fecha · Composer e envio de mensagem funcionam.

---

### Fase 2: Experiência de Mensagem
> Entrega: bolhas redesenhadas com avatares, painel de correção completo com diff e "Entendi" funcionais.

#### Task 4: Avatares e alinhamento das bolhas
- **Prova:** valida que `MessageBubble` recebe e renderiza dados de autor corretamente
- **Done-when:**
  - [ ] Mensagens alheias exibem avatar de iniciais à esquerda (cor derivada de hash do `authorId`)
  - [ ] Mensagens próprias alinhadas à direita, sem avatar
  - [ ] Autor não exibido como texto separado quando avatar está visível (DRY visual)
  - [ ] Prop `authorId` passado para `MessageBubble` a partir de `MessageList`
- **Verificar:** trocar entre mensagens de participantes diferentes e confirmar avatares distintos
- **Balizador:** se dois participantes têm cores de avatar diferentes, o hash está funcionando.

#### Task 5: Utilitário `lib/diff.ts` + dependência
- **Prova:** valida que o algoritmo de diff é isolado e retorna estrutura consumível por `CorrectionBlock`
- **Done-when:**
  - [ ] `diff-match-patch` instalado (`pnpm add diff-match-patch`)
  - [ ] `lib/diff.ts` exporta `computeDiff(original: string, corrected: string): DiffToken[]` onde `DiffToken = { text: string; changed: boolean }`
  - [ ] Strings iguais retornam todos os tokens com `changed: false`
  - [ ] Substituição retorna tokens corretos com `changed: true` nas partes alteradas
- **Verificar:** `pnpm test --run src/lib/__tests__/diff.test.ts`
- **Balizador:** se o teste de strings iguais passa, a integração com a lib está correta.

#### Task 5T: Testes — `lib/diff`
- **Cobre:** `computeDiff` introduzida na Task 5
- **Done-when:**
  - [ ] Strings iguais → nenhum token `changed`
  - [ ] Substituição de palavra → tokens alterados marcados como `changed: true`
  - [ ] Adição de palavra → token novo marcado como `changed: true`
  - [ ] Remoção de palavra → token ausente no resultado (`corrected` não contém a palavra)
- **Verificar:** `pnpm test --run`

#### Task 6: `CorrectionBlock` redesenhado
- **Prova:** valida que o painel de correção entrega valor pedagógico completo e o dismiss funciona
- **Done-when:**
  - [ ] Badge "CORREÇÃO" teal visível acima do painel
  - [ ] Texto corrigido com tokens `changed` sublinhados (usando `computeDiff`)
  - [ ] Seção ANTES com texto original, seção DEPOIS com texto corrigido (tipografia mono)
  - [ ] Parágrafo de explicação (`correction.explanation`) exibido
  - [ ] Botão "Entendi" presente
  - [ ] Clicar "Entendi" → painel colapsa; badge e conteúdo desaparecem
  - [ ] Sem botão "Copiar correção"
- **Verificar:** enviar mensagem com erro gramatical em modo automático e confirmar o painel completo
- **Balizador:** se o diff mostra exatamente a palavra alterada sublinhada, o `computeDiff` está integrado corretamente.

#### Task 6T: Testes — `MessageBubble` (painel de correção)
- **Cobre:** `CorrectionBlock` redesenhado na Task 6
- **Done-when:**
  - [ ] Badge "CORREÇÃO" renderizado quando `correction` presente e sem erro
  - [ ] Seção ANTES contém texto de `message.content`
  - [ ] Seção DEPOIS contém texto de `correction.content`
  - [ ] Clicar "Entendi" → badge e painel não mais no DOM
  - [ ] Testes existentes de `canAnalyze`, `isPending`, error state e ReactionBar ainda passam
- **Verificar:** `pnpm test --run`

---
**Checkpoint Fase 2:** build limpo · avatares visíveis · painel de correção completo e interativo · testes de diff e MessageBubble passando.

---

### Fase 3: Polish e Completude
> Entrega: `MessageList` com separadores de data, indicador de digitação animado e chip de modo automático; todos os critérios de aceite globais atendidos.

#### Task 7: Separadores de data em `MessageList`
- **Prova:** valida que a lógica de agrupamento por data é correta e não quebra a ordenação
- **Done-when:**
  - [ ] Função pura `groupMessagesByDate(messages)` em `lib/` retorna grupos com label (HOJE / ONTEM / `dd/MM/yyyy`)
  - [ ] `MessageList` insere separador visual entre grupos de datas diferentes
  - [ ] Mensagens do mesmo dia não têm separador entre si
- **Verificar:** simular mensagens de dois dias diferentes via devtools e confirmar separador
- **Balizador:** se mensagens do mesmo dia não têm separador, a comparação de datas está correta.

#### Task 8: Indicador de digitação animado
- **Prova:** valida que a bolha aparece e desaparece conforme eventos de typing
- **Done-when:**
  - [ ] Substitui o `<p>` atual por um componente com três pontos animados via `@keyframes`
  - [ ] Exibe nome(s) digitando acima ou integrado à bolha
  - [ ] Animação roda somente quando `typingNames.length > 0`
- **Verificar:** digitar em outra aba da mesma sala e confirmar a bolha animada
- **Balizador:** se a bolha some ao parar de digitar, a reatividade está correta.

#### Task 9: Chip "Correção da IA ativada"
- **Prova:** valida que o chip reflete o `agentMode` em tempo real
- **Done-when:**
  - [ ] Chip visível em `MessageList` (sticky bottom) quando `agentMode === 'automatic'`
  - [ ] Chip ausente no modo manual
  - [ ] Trocar o modo via settings drawer atualiza o chip imediatamente
- **Verificar:** alternar modo no drawer e confirmar aparecimento/desaparecimento do chip
- **Balizador:** se o chip some ao mudar para manual sem recarregar, o prop flow está correto.

#### Task 9T: Testes finais e verificação de regressão
- **Cobre:** `groupMessagesByDate` (função pura) + snapshot de regressão geral
- **Done-when:**
  - [ ] `groupMessagesByDate`: mesmo dia → 1 grupo; dias diferentes → N grupos com labels corretos
  - [ ] `pnpm test` passa sem nenhuma regressão nos testes existentes
  - [ ] `pnpm build` sem erros TypeScript
- **Verificar:** `pnpm test --run && pnpm build`

---
**Checkpoint Fase 3:** build limpo · todos os critérios de aceite globais atendidos · demo E2E completa navegável no browser.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `diff-match-patch` sem tipos TypeScript nativos | Média | Médio | Usar `@types/diff-match-patch` ou substituir por pacote `diff` (tipagem nativa) |
| Drawer overlay conflitando com z-index de elementos existentes (dialog, reaction picker) | Baixa | Baixo | Definir `z-index` hierárquico explícito no CSS do drawer |
| Regressão nos testes de `MessageBubble` ao refatorar `CorrectionBlock` | Média | Alto | Rodar `pnpm test` após cada sub-task da Fase 2 antes de avançar |
| Layout quebrando em viewport ≤ 900 px com o nav adicionado | Baixa | Médio | Testar media query existente após Task 1 |

## 8. Perguntas em aberto

- (nenhuma — todas as ramificações foram resolvidas no grill-me)
