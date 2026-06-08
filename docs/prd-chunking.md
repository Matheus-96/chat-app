# Chunking Feature — PRD

## Problem Statement

Language learners using Chat Writing Coach want deeper insights into how sentences are constructed and how words translate in context. Currently, the app only shows:
1. Binary pass/fail feedback (message is correct or has errors)
2. Full-sentence corrections with diffs

Learners struggle to understand:
- How individual phrases within a sentence translate
- Which semantic units ("chunks") make up the overall meaning
- The relationship between word groups and their translations

This limits pedagogical value, especially for complex sentences with multiple clauses or unfamiliar constructions.

## Solution

Add a **Chunking analysis mode** that breaks down a sentence into meaningful semantic units and provides translations for each chunk. This complements the existing correction flow without replacing it.

**Example:**
Original: "The horse is riding the wave of flames above the desert."
Chunks:
- "The horse" → "O cavalo"
- "is riding" → "está montando"  
- "the wave of flames" → "a onda de chamas"
- "above the desert" → "acima do deserto"

Users can request chunking analysis alongside (or instead of) the automatic correction, gaining insight into sentence structure and vocabulary in context.

## User Stories

1. As a language learner, I want to break down complex sentences into chunks, so that I can understand how each part translates
2. As a learner with a sentence that has no errors, I want to analyze its structure with chunking, so that I can learn vocabulary in context
3. As a learner who already received a correction, I want to also see chunking analysis, so that I can understand both the error and the structure
4. As a learner, I want chunking to show semantic units (not just individual words), so that translations make sense in context
5. As a learner, I want to expand/collapse chunking blocks, so that the UI remains clean
6. As a learner using the app on mobile, I want chunking rendered as a table, so that it's readable on small screens
7. As a learner, I want to re-analyze a message with chunking multiple times, so that I can request a fresh analysis if needed
8. As a learner, I want chunking to be pedagoically clear, so that I understand how the sentence is built grammatically
9. As a learner, I want chunking alongside correction, so that I can learn both error-correction and structure simultaneously
10. As a learner, I want instant feedback when chunking analysis fails, so that I know to retry instead of guessing

## Implementation Decisions

### Data Structure

**RoomMessage extension:** Add a new optional field to `RoomMessage`:
```typescript
chunking?: {
  chunks: Array<{
    text: string      // "The horse" — original chunk
    analysis: string  // "O cavalo" — translation
  }>
}
```

Chunking is stored independently from `correction` (which remains a separate message with `replyToMessageId`). Both can coexist on the same original message.

### Frontend Rendering

**MessageBubble props:** Add new prop:
- `chunking?: { chunks: Array<{ text: string; analysis: string }> }`

**Rendering order:** If both correction and chunking exist, render as:
1. Original message content
2. "Analisar com agente" and "Chunking" buttons (side by side)
3. Correction block (if exists, collapsible with "-" / "+" toggle, badge "CORREÇÃO")
4. Chunking block (if exists, collapsible with "-" / "+" toggle, badge "CHUNKING")

**Chunking block visual:**
- Header: badge "CHUNKING" + collapse toggle ("-" / "+")
- Content: HTML table with 2 columns: "Chunk" | "Tradução"
- Rows: one row per chunk with text and analysis
- Collapse/expand behavior matches correction block (no separate "Entendi" button)

### WebSocket Protocol

**Client event:** Extend `analyze_message` with a `mode` parameter:
```typescript
{
  type: 'analyze_message',
  messageId: string,
  mode: 'normal' | 'chunking',
  apiKey?: string,
  customInstructions?: string
}
```

**Server event:** Server responds with message update:
```typescript
{
  type: 'message_update',
  messageId: string,
  chunking: {
    chunks: Array<{ text: string; analysis: string }>
  }
}
```

### AI Prompt

When `mode: 'chunking'`, the backend sends this prompt to the LLM:

> "Break this sentence into chunks that help a language learner understand its structure. Group consecutive words that form a meaningful unit (noun phrase, verb phrase, prepositional phrase, etc). Each chunk's translation should help explain how the sentence works. Return as JSON: { chunks: [{ text: \"...\", analysis: \"...\" }] }"

The LLM is responsible for identifying natural semantic boundaries (phrases, clauses, noun/verb groups) and providing translations that preserve meaning in context.

### State Management

**MessageList:** Extend the `replies` Map to also include chunking results. Current logic finds corrections via `replyToMessageId`; chunking is stored directly on the message.

**useRoomConnection:** Extend `analyzeMessage` action to pass `mode` parameter:
```typescript
analyzeMessage(messageId: string, mode: 'normal' | 'chunking' = 'normal')
```

**Loading state:** Reuse existing `isPending` state for both normal and chunking analysis. UI shows "Coach analisando..." for both modes.

### Error Handling

If chunking analysis fails:
- Show an error block similar to the existing `ErrorBlock` component
- Display "Análise indisponível"
- Provide a "Analisar" button that re-triggers the chunking request

### Multiple Chunking

If a user clicks "Chunking" multiple times on the same message, the new analysis **overwrites** the previous one. Only one chunking result is shown at a time.

### UI Details

- **Button labels:** "Analisar com agente" and "Chunking" (both on same line)
- **Badge text:** "CHUNKING"
- **Table headers:** "Chunk" | "Tradução"
- **Accessibility:** Expandable sections with aria-labels for screen readers

## Testing Decisions

### What Makes a Good Test

- Tests external behavior: clicking buttons, receiving data, updating UI
- Does not test implementation details: component structure, internal state mutations, render counts
- Reuses existing test seams: MessageBubble component tests, MessageList integration tests
- Tests both happy path and error cases

### Modules to Test

1. **MessageBubble.tsx**
   - New `chunking` prop renders chunking block when present
   - Chunking block renders table with correct headers and rows
   - Collapse/expand toggle works for chunking block
   - Chunking and correction coexist without conflicts
   - Error block appears when chunking has `error: true`

2. **useRoomConnection.ts**
   - `analyzeMessage(messageId, 'chunking')` sends correct event with `mode: 'chunking'`
   - `analyzeMessage(messageId, 'normal')` sends event with `mode: 'normal'` (default)

3. **RoomMessage protocol**
   - Server events with `chunking` field are parsed correctly
   - `message_update` events update message state properly

4. **Integration: MessageList + MessageBubble**
   - When chunking arrives via WebSocket, correct message is updated
   - Both correction and chunking appear together when both exist

### Prior Art

- Existing `CorrectionBlock` component test shows how to test expandable blocks
- Existing MessageBubble tests show how to test button clicks and callbacks
- RoomStore tests show how to test state updates from WebSocket events

## Out of Scope

- **Chunking for multiple languages:** Feature focuses on English→Portuguese; extending to other language pairs is future work
- **Persistent chunking history:** Chunking results are not persisted after browser reload (aligns with current correction behavior)
- **Custom chunk boundaries:** User cannot manually adjust how sentences are chunked; this is AI-driven
- **Chunking for automatic mode:** Only available in manual mode (user-initiated). Automatic corrections don't trigger chunking
- **Grammar/syntax tagging:** Chunks don't show part-of-speech tags (e.g., "Noun Phrase", "Verb Phrase") — just translations
- **Performance optimization for long messages:** No pagination or virtual scrolling for very long chunked analyses (tables remain full-size)

## Further Notes

- **Pedagogical intent:** Chunking is designed for language learners to understand sentence construction. The grouping should prioritize **meaningful semantic units** over word-by-word breakdown.
- **Consistency with correction flow:** Chunking integrates seamlessly with the existing correction block—both can appear, neither requires the other.
- **No persistence:** Like corrections today, chunking is ephemeral (in-memory on the server). If the server restarts, chunking history is lost.
- **API key requirement:** Chunking analysis requires the same API key as corrections (OpenRouter key provided by the user).
