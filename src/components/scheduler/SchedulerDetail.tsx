import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Flame, Trophy, Lock, CheckCircle2, ChevronDown, ChevronUp, Loader2, BookOpen, Target, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchedulerDetail, SchedulerDay, SchedulerQuestion } from "@/hooks/useSchedulers";
import { QuizModal } from "./QuizModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Props {
  schedulerId: string;
  onBack: () => void;
}

export function SchedulerDetail({ schedulerId, onBack }: Props) {
  const { scheduler, days, loading, upsertDay, saveQuestions, completeDay, unlockDay, refetch } = useSchedulerDetail(schedulerId);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [generatingDay, setGeneratingDay] = useState<number | null>(null);
  const [quizDay, setQuizDay] = useState<SchedulerDay | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<SchedulerQuestion[]>([]);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const { toast } = useToast();

  // Initialize day 1 as unlocked once scheduler loads
  useEffect(() => {
    if (!scheduler || days.length === 0) return;
    const day1 = days.find(d => d.day_number === 1);
    if (day1 && !day1.is_unlocked) {
      upsertDay({ scheduler_id: schedulerId, day_number: 1, is_unlocked: true, title: day1.title, content: day1.content, outcomes: day1.outcomes });
    }
  }, [scheduler?.id, days.length]);

  // Calendar-day-change unlock: unlock next day if the calendar date has advanced since scheduler creation
  // Respects the plan's max_unlock_per_day limit
  useEffect(() => {
    if (!scheduler || days.length === 0) return;
    const createdDate = new Date(scheduler.created_at);
    createdDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysPassed = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxUnlockable = Math.min(daysPassed + 1, scheduler.total_days);
    for (let d = 1; d <= maxUnlockable; d++) {
      const dayData = days.find(x => x.day_number === d);
      if (!dayData || !dayData.is_unlocked) {
        unlockDay(d);
      }
    }
  }, [scheduler?.id, days.length]);

  const generateDayContent = useCallback(async (dayNumber: number) => {
    if (!scheduler) return;
    setGeneratingDay(dayNumber);
    try {
      const { data, error } = await supabase.functions.invoke("scheduler-ai", {
        body: { action: "generate-day", subject: scheduler.subject, topics: scheduler.topics, totalDays: scheduler.total_days, dayNumber },
      });
      if (error) throw error;
      await upsertDay({
        scheduler_id: schedulerId,
        day_number: dayNumber,
        title: data.title || `Day ${dayNumber}`,
        content: data.content || "",
        outcomes: data.outcomes || [],
        is_unlocked: dayNumber === 1 || (days.find(d => d.day_number === dayNumber)?.is_unlocked ?? false),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGeneratingDay(null);
    }
  }, [scheduler, schedulerId, days, upsertDay, toast]);

  const handleExpandDay = async (dayNumber: number) => {
    if (expandedDay === dayNumber) { setExpandedDay(null); return; }
    setExpandedDay(dayNumber);
    const day = days.find(d => d.day_number === dayNumber);
    if (!day || !day.content) {
      await generateDayContent(dayNumber);
    }
  };

  const handleMarkComplete = async (day: SchedulerDay) => {
    setQuizDay(day);
    setQuizOpen(true);
    setGeneratingQuiz(true);
    setQuizQuestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("scheduler-ai", {
        body: { action: "generate-quiz", subject: scheduler?.subject, dayContent: day.content },
      });
      if (error) throw error;
      const rawQs = data.questions || [];
      const saved = await saveQuestions(day.id, rawQs.map((q: { question: string; options: string[]; correct_answer: number; explanation?: string }) => ({
        scheduler_day_id: day.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        user_answer: null,
      })));
      setQuizQuestions(saved.map((q, i) => ({ ...q, options: Array.isArray(q.options) ? q.options as string[] : [], explanation: rawQs[i]?.explanation })));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Quiz generation failed", description: msg, variant: "destructive" });
      setQuizOpen(false);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleQuizSubmit = async (correct: number, total: number) => {
    if (!quizDay) return;
    const passed = await completeDay(quizDay.id, correct, total);
    if (passed) {
      toast({ title: `🎉 Day ${quizDay.day_number} unlocked!`, description: `${correct}/${total} correct — next day awaits.` });
    } else {
      toast({ title: "Keep going!", description: `${correct}/${total} — review the content and try again.`, variant: "destructive" });
    }
  };

  const handleRetryQuiz = async () => {
    if (!quizDay) return;
    setGeneratingQuiz(true);
    setQuizQuestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("scheduler-ai", {
        body: { action: "generate-quiz", subject: scheduler?.subject, dayContent: quizDay.content },
      });
      if (error) throw error;
      const rawQs = data.questions || [];
      const saved = await saveQuestions(quizDay.id, rawQs.map((q: { question: string; options: string[]; correct_answer: number }) => ({
        scheduler_day_id: quizDay.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        user_answer: null,
      })));
      setQuizQuestions(saved.map((q, i) => ({ ...q, options: Array.isArray(q.options) ? q.options as string[] : [], explanation: rawQs[i]?.explanation })));
    } finally {
      setGeneratingQuiz(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!scheduler) return null;

  const completedDays = days.filter(d => d.is_completed).length;
  const progress = scheduler.is_completed ? 100 : Math.round((completedDays / scheduler.total_days) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary/80 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-xl">{scheduler.subject}</h1>
          {scheduler.topics && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{scheduler.topics}</p>}
        </div>
        {scheduler.streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium">
            <Flame className="h-4 w-4" /> {scheduler.streak}-day streak
          </div>
        )}
        {scheduler.is_completed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-sm font-medium">
            <Trophy className="h-4 w-4" /> Completed!
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="glass-strong rounded-2xl border border-border/50 p-5 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-2xl font-bold">{progress}%</span>
            <span className="text-muted-foreground text-sm ml-2">complete</span>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{completedDays}</span> / {scheduler.total_days} days
          </div>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              scheduler.is_completed
                ? "bg-green-500"
                : "bg-gradient-to-r from-primary via-cyan-400 to-blue-400"
            )}
          />
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {scheduler.total_days - completedDays} days remaining</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Score ≥3/5 to advance</span>
        </div>
      </div>

      {/* Day List */}
      <div className="space-y-3">
        {Array.from({ length: scheduler.total_days }, (_, i) => i + 1).map((dayNum) => {
          const day = days.find(d => d.day_number === dayNum);
          const isUnlocked = dayNum === 1 || (day?.is_unlocked ?? false);
          const isCompleted = day?.is_completed ?? false;
          const isExpanded = expandedDay === dayNum;
          const isGenerating = generatingDay === dayNum;

          return (
            <motion.div
              key={dayNum}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dayNum * 0.03 }}
              className={cn(
                "glass-strong rounded-xl border transition-all overflow-hidden",
                isCompleted ? "border-green-500/30 bg-green-500/5" :
                isUnlocked ? "border-border/50 hover:border-primary/30" :
                "border-border/20 opacity-60"
              )}
            >
              {/* Day Header */}
              <button
                className="w-full flex items-center gap-4 p-4 text-left"
                onClick={() => isUnlocked && handleExpandDay(dayNum)}
                disabled={!isUnlocked}
              >
                {/* Day Icon */}
                <div className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold",
                  isCompleted ? "bg-green-500/20 text-green-500" :
                  isUnlocked ? "bg-primary/10 text-primary" :
                  "bg-secondary/50 text-muted-foreground"
                )}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isUnlocked ? dayNum : <Lock className="h-3.5 w-3.5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {day?.title || `Day ${dayNum}`}
                    </span>
                    {isCompleted && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">
                        {day?.questions_correct}/{day?.questions_attempted} ✓
                      </span>
                    )}
                  </div>
                  {!isUnlocked && (
                    <p className="text-xs text-muted-foreground mt-0.5">Complete Day {dayNum - 1} to unlock</p>
                  )}
                </div>

                {isUnlocked && (
                  <div className="flex items-center gap-2">
                    {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-border/30">
                      {isGenerating ? (
                        <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-sm">Generating content for Day {dayNum}...</span>
                        </div>
                      ) : day?.content ? (
                        <div className="space-y-4 pt-4">
                          {/* Outcomes */}
                          {day.outcomes && day.outcomes.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Target className="h-3 w-3" /> Learning Outcomes
                              </p>
                              <ul className="space-y-1">
                                {day.outcomes.map((o, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                                    {o}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Content */}
                          <div className="prose prose-sm max-w-none text-foreground/90">
                            <ReactMarkdown
                              components={{
                                h2: ({ children }) => <h2 className="text-base font-bold mt-4 mb-2 text-foreground">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
                                p: ({ children }) => <p className="text-sm leading-relaxed mb-2 text-foreground/80">{children}</p>,
                                ul: ({ children }) => <ul className="space-y-1 mb-2 ml-4">{children}</ul>,
                                li: ({ children }) => <li className="text-sm text-foreground/80 list-disc">{children}</li>,
                                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                              }}
                            >
                              {day.content}
                            </ReactMarkdown>
                          </div>

                          {/* Actions */}
                          <div className="pt-2 flex gap-3">
                            {!isCompleted ? (
                              <Button
                                className="gap-2"
                                onClick={() => handleMarkComplete(day)}
                              >
                                <BookOpen className="h-4 w-4" />
                                Mark as Completed & Take Quiz
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-500 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4" />
                                Completed — {day.questions_correct}/5 correct
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-12">
                          <Button variant="outline" onClick={() => generateDayContent(dayNum)} className="gap-2">
                            <Zap className="h-4 w-4" /> Generate Content
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Quiz Modal */}
      {quizOpen && quizDay && (
        <QuizModal
          open={quizOpen}
          questions={quizQuestions}
          generating={generatingQuiz}
          dayNumber={quizDay.day_number}
          onAnswer={() => {}}
          onSubmit={handleQuizSubmit}
          onRetry={handleRetryQuiz}
          onClose={() => { setQuizOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}
