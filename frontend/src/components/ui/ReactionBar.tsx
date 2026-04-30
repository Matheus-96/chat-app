// ReactionBar component: displays reaction summary and a button to open picker
import * as React from "react";
import { Emoji, ReactionSummary } from "@/lib/reactions";
import { Button } from "./button";
import { ReactionPicker } from "./ReactionPicker";
import { useReactions } from "../hooks/useReactions";

interface ReactionBarProps {
  /** id of the message we are reacting to */
  messageId: string;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ messageId }) => {
  const { data, isLoading, error, addReaction, removeReaction } = useReactions(messageId);
  const [open, setOpen] = React.useState(false);

  const summary = data?.summary;

  const handleSelect = async (emoji: Emoji) => {
    try {
      await addReaction(emoji);
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {isLoading && <span>Loading…</span>}
      {error && <span className="text-destructive">Error loading reactions</span>}
      {summary && (
        <div className="flex items-center space-x-1">
          {Object.entries(summary.counts).map(([emoji, count]) => (
            <Button
              key={emoji}
              size="xs"
              variant="outline"
              onClick={() => handleSelect(emoji as Emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji} {count > 0 && <span>{count}</span>}
            </Button>
          ))}
        </div>
      )}
      <Button size="xs" onClick={() => setOpen(true)} aria-label="Add reaction">
        +
      </Button>
      <ReactionPicker open={open} onClose={() => setOpen(false)} onSelect={handleSelect} />
    </div>
  );
};
