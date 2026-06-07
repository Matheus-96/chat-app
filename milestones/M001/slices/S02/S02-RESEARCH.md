## Design Research – Reactions Feature (Slice S02)

**Milestone:** M001 – Chat Application
**Slice:** S02 – Reactions (emoji set, one per participant)

---
### 1. Design Considerations

- **One reaction per participant per message** – prevents spamming and simplifies aggregation.
- **Emoji set** should be limited to a curated list (e.g., 👍, 👎, 😂, 🎉, ❤️) to keep UI tidy and reduce storage.
- **Accessibility** – each reaction must have an accessible label (`aria-label="thumbs up"`). Use WCAG‑2.1 contrast guidelines for the reaction button.
- **Responsiveness** – works on mobile and desktop; emoji buttons should be large enough for touch (≥48 dp) and keyboard‑focusable.
- **Real‑time sync** – reactions are broadcast via WebSocket to all participants in the room.
- **Privacy** – participants can see who reacted but not a list of all users who reacted with the same emoji (only count is shown).
- **Extensibility** – store reactions as a separate collection in the backend so new emojis can be added without schema changes.

---
### 2. UI Components (Frontend)

| Component | Description | Props / State |
|-----------|-------------|---------------|
| **ReactionBar** | Appears below each chat bubble, shows the limited emoji set and the current count per emoji. | `messageId`, `userId`, `reactions` (object `{emoji: count}`) |
| **ReactionButton** | Clickable/tappable button for a single emoji. Handles optimistic UI update. | `emoji`, `isSelected` (boolean), `onSelect` |
| **ReactionTooltip** | Shows a tooltip with the count and a short description for screen‑reader users. | `count`, `emoji`, `visible` |

Implementation notes:
- Use **React.memo** for `ReactionButton` to avoid re‑renders across many messages.
- Apply **ARIA roles**: `button` with `aria-pressed` for selected state.
- Use **Tailwind CSS** utility classes for spacing and hover/focus states.
- Add a **focus-visible** style for keyboard navigation.

---
### 3. Data Model (Backend)

```ts
// backend/src/models/reaction.ts
export interface Reaction {
  messageId: string;          // UUID of the chat message
  userId: string;             // UUID of the participant who reacted
  emoji: string;              // Emoji shortcut, e.g. "thumbs_up"
  createdAt: Date;
}
```

- Store in a **MongoDB** collection named `reactions` (or whichever DB the project uses).
- Indexes: `{ messageId: 1, emoji: 1 }` for aggregation, `{ userId: 1, messageId: 1 }` to enforce the *one‑reaction‑per‑user* rule.
- API endpoints (REST) – optional, but primary flow uses **WebSocket** messages:
  - `reaction:add` – payload `{ messageId, emoji }`
  - `reaction:remove` – payload `{ messageId, emoji }`
- Server validates:
  1. Emoji belongs to the allowed set.
  2. User has not already reacted with the same emoji on that message.
  3. If user reacts with a *different* emoji, previous reaction is removed (so only one per user).

---
### 4. Implementation Steps

1. **Define allowed emojis** (frontend constant & backend validation list).
2. Add **Reaction model** file in `backend/src/models/` and update the DB schema if needed.
3. Implement **WebSocket handlers** in `backend/src/server.ts`:
   - Listen for `reaction:add`/`reaction:remove` events.
   - Perform validation, persist to DB, and broadcast `reaction:update` with the aggregated counts.
4. Create **React components** under `frontend/src/components/ui/`:
   - `ReactionBar.tsx`
   - `ReactionButton.tsx`
   - `ReactionTooltip.tsx`
5. Wire the components into the message bubble (`MessageBubble.tsx`):
   - Pass `message.id` and current reaction state.
   - Optimistically update UI on click, revert on server error.
6. Add **unit tests** (frontend) for component rendering and interaction, and **integration tests** (backend) for the WebSocket flow.
7. Update **styles** – ensure the bar aligns with existing chat UI and respects mobile breakpoints.
8. Run **accessibility audit** (`/home/victor/.agents/skills/accessibility`) to verify a11y compliance.
9. Document the feature in `docs/mvp-requirements.md` and update the slice README if present.
10. Verify end‑to‑end:
    - Start the dev server (`frontend/scripts/test_server.sh`).
    - Open a room, send a message, add a reaction, open a second client, ensure the count updates in real time.
    - Confirm only one reaction per user per message.

---
### 5. Risks & Mitigations

- **Race condition** – two clients reacting simultaneously could violate the one‑reaction rule. Mitigate with a DB unique index on `(messageId, userId)` and server‑side check.
- **Performance** – aggregating counts for high‑traffic rooms could be heavy. Use **MongoDB aggregation pipeline** and cache the result per message for the duration of the session.
- **Emoji rendering inconsistencies** across platforms. Use a **web‑font** (e.g., Twemoji) to guarantee uniform appearance.

---
### 6. Success Criteria

- ✅ UI shows a consistent reaction bar under each message.
- ✅ User can select an emoji; count updates instantly and persists after reload.
- ✅ Only one reaction per participant per message (validated by DB constraints).
- ✅ Screen‑reader announces the reaction button and its state.
- ✅ Real‑time updates propagate to all participants in the room.

---
*Prepared for slice planning (S02) in Milestone M001.*