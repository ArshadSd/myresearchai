import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onFeedback: (helpful: boolean) => void;
}

export function FeedbackModal({ open, onClose, onFeedback }: FeedbackModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 right-8 z-50 glass-strong rounded-2xl p-6 border border-border/50 shadow-xl max-w-xs"
        >
          <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <p className="font-semibold mb-1">Was this chat helpful?</p>
          <p className="text-xs text-muted-foreground mb-4">Your feedback helps us improve</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/50"
              onClick={() => onFeedback(true)}
            >
              <ThumbsUp className="h-4 w-4" /> Helpful
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
              onClick={() => onFeedback(false)}
            >
              <ThumbsDown className="h-4 w-4" /> Not Helpful
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
