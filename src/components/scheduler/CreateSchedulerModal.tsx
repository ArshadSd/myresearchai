import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, Calendar, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (subject: string, topics: string, days: number) => Promise<void>;
}

const DAY_PRESETS = [7, 14, 21, 30];

export function CreateSchedulerModal({ open, onClose, onCreate }: Props) {
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [days, setDays] = useState(14);
  const [customDays, setCustomDays] = useState("");
  const [loading, setLoading] = useState(false);

  const totalDays = customDays ? parseInt(customDays) || days : days;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || totalDays < 1) return;
    setLoading(true);
    try {
      await onCreate(subject.trim(), topics.trim(), totalDays);
      setSubject(""); setTopics(""); setDays(14); setCustomDays("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg glass-strong rounded-2xl border border-border/50 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Create Learning Journey</h2>
                  <p className="text-xs text-muted-foreground">AI will build your day-by-day progression</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/80 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="subject" className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-primary" /> Subject / Goal
                </Label>
                <Input
                  id="subject"
                  placeholder="e.g. Machine Learning, UPSC History, React.js..."
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topics" className="text-sm text-muted-foreground">
                  Specific Topics / Syllabus <span className="opacity-60">(optional)</span>
                </Label>
                <Textarea
                  id="topics"
                  placeholder="e.g. Neural networks, backpropagation, CNNs, RNNs, transformers..."
                  value={topics}
                  onChange={e => setTopics(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Exam Timeline
                </Label>
                <div className="flex gap-2">
                  {DAY_PRESETS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setDays(d); setCustomDays(""); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                        days === d && !customDays
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                  <Input
                    type="number"
                    placeholder="Custom"
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    className="flex-1 text-center"
                    min={1}
                    max={90}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {totalDays} days → AI will generate focused content for each day
                </p>
              </div>

              <Button type="submit" disabled={!subject.trim() || loading} className="w-full gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Journey...</> : <><Brain className="h-4 w-4" /> Start Learning Journey</>}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
