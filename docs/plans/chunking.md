# Plano: Chunking Feature

> **Status:** Rascunho
> **Criado em:** 2026-06-07
> **Origem:** PRD em `docs/prd-chunking.md`

## 1. O que estamos construindo

Add a **Chunking analysis mode** que quebra sentenças em unidades semânticas significativas com tradução para cada chunk. Feature integra ao fluxo existente de análise sem substituir correções. Usuários solicitam chunking com botão dedicado; análise sobrescreve chunking anterior (não há histórico).

## 2. Fora do escopo

- Chunking para múltiplos idiomas (foco: English→Portuguese)
- Persistência de histórico de chunking (ephemeral, em memória)
- Ajuste manual de limites de chunks pelo usuário
- Chunking no modo automático (só manual)
- Tags gramaticais (part-of-speech) nos chunks
- Otimização de performance para sentenças muito longas (sem paginação)

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | Chunking armazenado em campo separado `chunking?: { chunks: [...] }` na RoomMessage | Permite coexistência com correção; não reusa estrutura de mensagem de resposta | Modificação do schema RoomMessage; nova lógica de atualização no frontend |
| AD-2 | WebSocket `analyze_message` recebe parâmetro `mode: 'normal' \| 'chunking'` | Reutiliza fluxo existente; evita novo evento | Ambos os modos usam mesmo handler; AIProvider decide a estratégia |
| AD-3 | Server envia `message_update` (novo tipo de evento) quando chunking é processado | Diferencia de `message_created` (usado para correções com `replyToMessageId`) | Frontend precisa escutar novo evento type; ambos atualizam store, mas semanticamente diferentes |
| AD-4 | Análise de chunking **substitui** chunking anterior (não há múltiplos) | Simplicidade: sempre um resultado visível; usuário solicita fresh analysis facilmente | Campo `chunking` é scalar, não array |
| AD-5 | MessageBubble renderiza chunking em bloco expansível com tabela HTML (2 colunas: Chunk \| Tradução) | Consistência com CorrectionBlock; pedagógico; legível em mobile | Reutiliza CSS/componentes existentes; manutenção simplificada |

## 4. Requisitos

**RF-1:** Sistema deve aceitar requisição de chunking via WebSocket `analyze_message` com `mode: 'chunking'`
**RF-2:** AIProvider deve quebrar sentença em unidades semânticas e traduzir cada uma
**RF-3:** Backend deve armazenar resultado em campo `chunking` na RoomMessage (não como mensagem de resposta separada)
**RF-4:** Frontend deve receber `message_update` com `chunking` e atualizar estado
**RF-5:** MessageBubble deve renderizar bloco de chunking (expansível, tabela 2 colunas: "Chunk" | "Tradução")
**RF-6:** Usuário pode clicar botão "Chunking" (ao lado de "Analisar com agente") para disparar análise
**RF-7:** Se chunking falhar, mostrar `ErrorBlock` com botão "Analisar" de retry
**RF-8:** Clique de novo em "Chunking" sobrescreve análise anterior (não há múltiplos)

**RNF-1:** Reutilizar fluxo existente de análise (não criar novo path paralelo)
**RNF-2:** LLM prompt deve ênfatizar unidades semânticas, não palavra-por-palavra
**RNF-3:** Loading state compartilhado (`isPending`) com correção normal
**RNF-4:** Tabela de chunking accessível (aria-labels, semanticamente clara)

## 5. Critérios de Aceite Globais

- [ ] Build compila sem erros
- [ ] Fluxo E2E funciona: clica botão → chunking enviado → resultado renderizado
- [ ] Chunking e correção coexistem na mesma mensagem
- [ ] Sobrescrita de chunking anterior funciona
- [ ] Erro no chunking mostra ErrorBlock com retry
- [ ] Tests passam (backend + frontend)

## 6. Tasks

### Fase 1: Backend Core — Tracer Bullet
> **Entrega:** Backend processa requisição de chunking, retorna análise, frontend recebe via WebSocket.

#### Task 1: Extend AIProvider — define novo tipo `ChunkingResult`
- **Prova:** Interface clara separando `WritingFeedback` (correção) de `ChunkingResult` (análise semântica)
- **Done-when:**
  - [ ] `AIProvider.ts` define novo type `ChunkingResult = { chunks: Array<{ text: string; analysis: string }> }`
  - [ ] `AIProvider` interface expõe método `chunk(text: string, apiKey?: string): Promise<ChunkingResult>`
  - [ ] Typos e imports compilam
- **Verificar:** `cd backend && npm run type-check`
- **Balizador:** Se `AIProvider.ts` tem `chunk()` method com type correto, está certo.

#### Task 2: Implement chunking no OpenRouterProvider
- **Prova:** LLM consegue quebrar sentença em chunks com tradução
- **Done-when:**
  - [ ] `OpenRouterProvider.chunk()` envia prompt pedagógico ao LLM
  - [ ] Parse JSON response para array de chunks
  - [ ] Trata erro (timeout, invalid key) lançando `AIProviderError`
- **Verificar:** Rodar manual test (mock ou real API):
  ```bash
  cd backend
  npm run dev
  # Manually test via console ou curl
  ```
- **Balizador:** Se `OpenRouterProvider.chunk()` retorna `{ chunks: [{ text, analysis }, ...] }`, está certo.

#### Task 3: Extend RoomMessage — add campo `chunking`
- **Prova:** RoomMessage pode armazenar análise de chunking
- **Done-when:**
  - [ ] `RoomMessage` interface adiciona `chunking?: { chunks: Array<{ text: string; analysis: string }> }`
  - [ ] Storage adapter (InMemoryAdapter) suporta ler/escrever campo
  - [ ] Typos compilam
- **Verificar:** `cd backend && npm run type-check`
- **Balizador:** Se `RoomMessage.chunking` é opcional e typed, está certo.

#### Task 4: Extend AnalyzeMessage usecase — add parâmetro `mode`
- **Prova:** Usecase aceita `mode: 'normal' | 'chunking'` e chama AIProvider correto
- **Done-when:**
  - [ ] `analyzeMessage()` signature adiciona `mode?: 'normal' | 'chunking'` (default: 'normal')
  - [ ] Se `mode: 'chunking'`, chama `aiProvider.chunk()` em vez de `aiProvider.analyze()`
  - [ ] Resultado armazenado em `message.chunking` (não cria nova mensagem de resposta)
  - [ ] Erro é retornado com flag `error: true` (não cria mensagem de erro)
- **Verificar:** `cd backend && npm run type-check`
- **Balizador:** Se usecase retorna message com `chunking` field quando mode='chunking', está certo.

#### Task 5: Extend WebSocket handler — accept `mode` param, emit `message_update`
- **Prova:** Handler processa `analyze_message` com `mode`, chama usecase, envia evento correto
- **Done-when:**
  - [ ] `analyzeMessageSchema` (Zod) adiciona `mode?: z.enum(['normal', 'chunking'])`
  - [ ] Handler extrai `mode` e passa ao `analyzeMessage()` usecase
  - [ ] Se mode='chunking', emite novo event type `message_update` (não `message_created`):
    ```json
    {
      "type": "message_update",
      "messageId": "...",
      "chunking": { "chunks": [...] }
    }
    ```
  - [ ] Se correção falha, event é `{ type: 'message_update', messageId, error: true, errorReason }`
  - [ ] Compatibilidade backward: mode='normal' ainda emite `message_created` (não quebra)
- **Verificar:** Rodar tests handler (veja Task 11)
- **Balizador:** Se `analyze_message` com `mode: 'chunking'` emite `message_update`, está certo.

---
**Checkpoint Fase 1:** Backend compila, AIProvider.chunk() implementado, WebSocket handler emite `message_update`. Pronto pra frontend consumir.

---

### Fase 2: Frontend Integration — Rendering + Interaction
> **Entrega:** Frontend recebe chunking via WebSocket, renderiza na UI, usuário pode disparar análise.

#### Task 6: Extend RoomMessage protocol — add `message_update` event, `chunking` field
- **Prova:** Frontend types espelham backend; `message_update` é evento válido
- **Done-when:**
  - [ ] `protocol.ts` adiciona `message_update` ao union `ServerEvent`:
    ```typescript
    | { type: 'message_update'; messageId: string; chunking?: { chunks: [...] }; error?: boolean; errorReason?: string }
    ```
  - [ ] `RoomMessage` interface adiciona `chunking?: { chunks: Array<{ text: string; analysis: string }> }`
  - [ ] Build sem erros
- **Verificar:** `cd frontend && npm run type-check`
- **Balizador:** Se `ServerEvent` aceita `message_update`, está certo.

#### Task 7: Extend useRoomConnection — pass `mode` to `analyzeMessage()`
- **Prova:** Frontend envia `mode: 'chunking'` quando usuário clica botão
- **Done-when:**
  - [ ] `analyzeMessage()` signature muda: `analyzeMessage(messageId: string, mode?: 'normal' | 'chunking')`
  - [ ] Envia event com modo: `{ type: 'analyze_message', messageId, mode, ... }`
  - [ ] Default é 'normal' (backward compat)
- **Verificar:** Rodar frontend, inspect console WebSocket messages
- **Balizador:** Se `analyze_message` event contém `mode`, está certo.

#### Task 8: Create ChunkingBlock component — tabla expansível
- **Prova:** Component renderiza chunks em tabela 2 colunas, collapsa/expande
- **Done-when:**
  - [ ] Novo file: `MessageBubble.tsx` ganha nova função `ChunkingBlock()`
  - [ ] Renderiza badge "CHUNKING" + toggle button ("-" / "+")
  - [ ] Content: HTML `<table>` com headers "Chunk" | "Tradução"
  - [ ] Rows: loop `chunking.chunks.map((chunk) => <tr><td>{chunk.text}</td><td>{chunk.analysis}</td></tr>)`
  - [ ] Collapse/expand state controlado (useState, similar a CorrectionBlock)
  - [ ] Se `error: true`, mostra `ErrorBlock` (reutiliza component existente)
- **Verificar:** Rodar frontend e inspecionar DOM
- **Balizador:** Se tabela renderiza com 2 colunas e collapsa, está certo.

#### Task 9: Extend MessageBubble — render chunking block, handle `message_update`
- **Prova:** MessageBubble renderiza chunking alongside correção
- **Done-when:**
  - [ ] `MessageBubbleProps` adiciona `chunking?: { chunks: [...] }`
  - [ ] Renderização order: content → buttons → correction → **chunking**
  - [ ] Ambos coexistem (não mutuamente exclusivos)
- **Verificar:** Pass chunking via props, verify render
- **Balizador:** Se MessageBubble renderiza correção E chunking, está certo.

#### Task 10: Add "Chunking" button ao lado de "Analisar com agente"
- **Prova:** Usuário vê dois botões lado a lado, pode clicar
- **Done-when:**
  - [ ] Novo button: `<Button onClick={() => onAnalyze(message.id, 'chunking')}>Chunking</Button>`
  - [ ] Ao lado de "Analisar com agente" (mesma linha, flex layout)
  - [ ] Disabled quando `isPending` (loading) ou `canAnalyze` é false (mesmo as outros)
  - [ ] `onAnalyze` prop signature: `(messageId: string, mode?: 'normal' | 'chunking') => void`
- **Verificar:** Rodar frontend, clica botão, inspect WebSocket
- **Balizador:** Se botão "Chunking" envia `mode: 'chunking'`, está certo.

#### Task 10b: Update store + handler para processar `message_update`
- **Prova:** Store atualiza message com novo campo `chunking` quando evento chega
- **Done-when:**
  - [ ] `roomStore.ts` adiciona handler para `message_update` event
  - [ ] Event é parseado, message encontrada, `chunking` field atualizado
  - [ ] UI reativa (component re-render com novo `chunking` prop)
- **Verificar:** Rodar frontend, send `message_update` via WebSocket, verify store state
- **Balizador:** Se store atualiza `message.chunking`, está certo.

---
**Checkpoint Fase 2:** Frontend renderiza chunking, usuário pode disparar análise. E2E flow completo.

---

### Fase 3: Tests + Polish
> **Entrega:** Backend e frontend tests passam; feature está production-ready.

#### Task 11: Tests — Backend (AIProvider, AnalyzeMessage, handler)
- **Cobre:** 
  - `OpenRouterProvider.chunk()` com input/output válidos
  - `AnalyzeMessage` usecase com `mode: 'chunking'` retorna message com `chunking` field
  - WebSocket handler emite `message_update` quando mode='chunking'
  - Erro handling (AIProviderError, timeout)
- **Done-when:**
  - [ ] Test file: `src/application/usecases/__tests__/AnalyzeMessage.test.ts`
  - [ ] Test: `AnalyzeMessage with mode='chunking' returns message with chunking field`
  - [ ] Test: `AnalyzeMessage with mode='chunking' error returns message with error flag`
  - [ ] Test file: `src/interface/ws/__tests__/handler.test.ts` (nova test)
  - [ ] Test: `Handler emits message_update when analyze_message has mode='chunking'`
  - [ ] Tests rodam: `cd backend && npm run test`
- **Verificar:** `cd backend && npm run test`
- **Balizador:** Se testes passam e cobrem chunking path, está certo.

#### Task 12: Tests — Frontend (MessageBubble, useRoomConnection, store)
- **Cobre:**
  - MessageBubble renderiza `chunking` prop
  - ChunkingBlock renderiza tabela com chunks
  - Collapse/expand toggle funciona
  - useRoomConnection envia `mode: 'chunking'` ao chamar `analyzeMessage(id, 'chunking')`
  - Store processa `message_update` event
- **Done-when:**
  - [ ] Test file: `src/features/chat/components/__tests__/MessageBubble.test.tsx` (extend)
  - [ ] Test: `MessageBubble renders chunking block when chunking prop exists`
  - [ ] Test: `ChunkingBlock renders table with chunks`
  - [ ] Test: `ChunkingBlock toggles collapse/expand`
  - [ ] Test file: `src/features/chat/hooks/__tests__/useRoomConnection.test.ts` (nova test)
  - [ ] Test: `analyzeMessage with mode='chunking' sends correct event`
  - [ ] Test file: `src/store/__tests__/roomStore.test.ts` (extend)
  - [ ] Test: `Store processes message_update event and updates chunking field`
  - [ ] Tests rodam: `cd frontend && npm run test`
- **Verificar:** `cd frontend && npm run test`
- **Balizador:** Se testes passam e cobrem chunking path, está certo.

#### Task 13: Manual E2E test + polish
- **Prova:** Feature funciona end-to-end em ambiente local
- **Done-when:**
  - [ ] Backend rodando: `npm run dev` (backend)
  - [ ] Frontend rodando: `npm run dev` (frontend)
  - [ ] Usuário entra numa sala
  - [ ] Clica "Chunking" numa mensagem
  - [ ] Vê loading "Coach analisando..."
  - [ ] Chunks aparecem em tabela expansível
  - [ ] Pode colapsar/expandir
  - [ ] Clica "Chunking" de novo → sobrescreve análise anterior
  - [ ] Se erro: vê "Análise indisponível" + botão "Analisar" (retry)
  - [ ] Correção e chunking coexistem visualmente
- **Verificar:** Manual browser test
- **Balizador:** Se feature funciona E2E sem erros, está pronto.

---
**Checkpoint Fase 3:** Testes passam, feature completa e estável.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| LLM não quebra semânticamente bem (chunks não fazem sentido) | Média | Alto — feature pedagógica falha | Refinar prompt; testar com exemplos variados; fallback simples se LLM falhar |
| WebSocket `message_update` quebra consumers existentes | Baixa | Alto — regressão | Adicionar event type antes; testar backward compat |
| Performance em sentenças muito longas (muitos chunks) | Baixa | Médio — UX degradada | Não otimizar agora; monitorar; escopo futuro é paginação |
| Conflito entre correção e chunking na UI (clutter) | Baixa | Médio — confusão visual | Design review; considerar aba/toggle se houver feedback |

## 8. Perguntas em aberto

- [x] Múltiplos chunkings ou substituir anterior? → **Substituir**
- [ ] Há alguma decisão arquitetural que conflita com patterns existentes?
- [ ] Performance é preocupação (muitos chunks)? → Resolver na Fase 3 se necessário

