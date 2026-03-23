import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ChevronRight, Trophy, RotateCcw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchedulerQuestion } from "@/hooks/useSchedulers";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  questions: SchedulerQuestion[];
  generating: boolean;
  onAnswer: (questionId: string, answer: number) => void;
  onSubmit: (correct: number, total: number) => void;
  onRetry: () => void;
  onClose: () => void;
  dayNumber: number;
}

export function QuizModal({ open, questions, generating, onAnswer, onSubmit, onRetry, onClose, dayNumber }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const current = questions[currentIdx];
  const allAnswered = questions.length > 0 && questions.every(q => selectedAnswers[q.id] !== undefined);
  const correctCount = questions.filter(q => selectedAnswers[q.id] === q.correct_answer).length;
  const passed = correctCount >= 3;

  const handleSelect = (qId: string, idx: number) => {
    if (revealed[qId]) return;
    setSelectedAnswers(prev => ({ ...prev, [qId]: idx }));
    setRevealed(prev => ({ ...prev, [qId]: true }));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(correctCount, questions.length);
  };

  const handleRetry = () => {
    setCurrentIdx(0);
    setSelectedAnswers({});
    setRevealed({});
    setSubmitted(false);
    onRetry();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-xl glass-strong rounded-2xl border border-border/50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base">Day {dayNumber} Knowledge Check</h3>
              <p className="text-xs text-muted-foreground">Score ≥3/5 to unlock next day</p>
            </div>
            <div className="ml-auto text-sm font-medium text-muted-foreground">
              {currentIdx + 1} / {generating ? "..." : questions.length}
            </div>
          </div>
          {!generating && questions.length > 0 && (
            <div className="mt-3 flex gap-1">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-all",
                    i < currentIdx
                      ? revealed[q.id]
                        ? selectedAnswers[q.id] === q.correct_answer ? "bg-green-500" : "bg-red-500"
                        : "bg-muted-foreground/30"
                      : i === currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 min-h-[320px]">
          {generating ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Generating adaptive questions...</p>
            </div>
          ) : submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-48 gap-4 text-center"
            >
              {passed ? (
                <>
                  <div className="p-4 rounded-full bg-green-500/10">
                    <Trophy className="h-10 w-10 text-green-500" />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-green-500">{correctCount}/5 Correct!</p>
                    <p className="text-muted-foreground text-sm mt-1">Excellent! Next day unlocked 🎉</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-full bg-orange-500/10">
                    <XCircle className="h-10 w-10 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-orange-500">{correctCount}/5 Correct</p>
                    <p className="text-muted-foreground text-sm mt-1">Need 3+ to proceed. Review and try again.</p>
                  </div>
                </>
              )}
            </motion.div>
          ) : current ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="font-medium text-sm leading-relaxed">{current.question}</p>
                <div className="space-y-2">
                  {current.options.map((opt, i) => {
                    const isSelected = selectedAnswers[current.id] === i;
                    const isCorrect = current.correct_answer === i;
                    const isRevealed = revealed[current.id];

                    return (
                      <button
                        key={i}
                        onClick={() => handleSelect(current.id, i)}
                        disabled={isRevealed}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                          !isRevealed && "hover:border-primary/50 hover:bg-primary/5 border-border/50",
                          isRevealed && isCorrect && "border-green-500 bg-green-500/10 text-green-600",
                          isRevealed && isSelected && !isCorrect && "border-red-500 bg-red-500/10 text-red-600",
                          isRevealed && !isSelected && !isCorrect && "border-border/30 opacity-50",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span className={cn(
                            "flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold",
                            isRevealed && isCorrect ? "border-green-500 bg-green-500 text-white" :
                            isRevealed && isSelected && !isCorrect ? "border-red-500 bg-red-500 text-white" :
                            "border-border/50"
                          )}>
                            {isRevealed && isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                             isRevealed && isSelected && !isCorrect ? <XCircle className="h-3.5 w-3.5" /> :
                             String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* Footer */}
        {!generating && (
          <div className="px-6 pb-6 flex gap-3">
            {submitted ? (
              <>
                {!passed && (
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleRetry}>
                    <RotateCcw className="h-4 w-4" /> Try Again
                  </Button>
                )}
                <Button className="flex-1" onClick={onClose}>
                  {passed ? "Continue Journey →" : "Review Content"}
                </Button>
              </>
            ) : (
              <>
                {currentIdx < questions.length - 1 ? (
                  <Button
                    className="flex-1 gap-2"
                    disabled={!revealed[current?.id]}
                    onClick={handleNext}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 gap-2"
                    disabled={!allAnswered}
                    onClick={handleSubmit}
                  >
                    Submit Answers
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
