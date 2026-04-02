import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface SchedulerDay {
  id: string;
  scheduler_id: string;
  day_number: number;
  title: string;
  content: string;
  outcomes: string[];
  is_completed: boolean;
  is_unlocked: boolean;
  questions_correct: number;
  questions_attempted: number;
  created_at: string;
}

export interface SchedulerQuestion {
  id: string;
  scheduler_day_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  user_answer: number | null;
  explanation?: string;
  created_at: string;
}

export interface Scheduler {
  id: string;
  user_id: string;
  subject: string;
  topics: string | null;
  total_days: number;
  current_day: number;
  streak: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export function useSchedulers() {
  const [schedulers, setSchedulers] = useState<Scheduler[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSchedulers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("schedulers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    setSchedulers((data as Scheduler[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSchedulers(); }, [fetchSchedulers]);

  const createScheduler = async (subject: string, topics: string, totalDays: number): Promise<Scheduler | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("schedulers")
      .insert({ user_id: user.id, subject, topics: topics || null, total_days: totalDays })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    await fetchSchedulers();
    return data as Scheduler;
  };

  const deleteScheduler = async (id: string) => {
    const { error } = await supabase.from("schedulers").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setSchedulers(prev => prev.filter(s => s.id !== id));
    toast({ title: "Scheduler deleted" });
  };

  const renameScheduler = async (id: string, newSubject: string) => {
    const { error } = await supabase.from("schedulers").update({ subject: newSubject }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setSchedulers(prev => prev.map(s => s.id === id ? { ...s, subject: newSubject } : s));
    toast({ title: "Scheduler renamed" });
  };

  const duplicateScheduler = async (scheduler: Scheduler): Promise<Scheduler | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("schedulers")
      .insert({ user_id: user.id, subject: scheduler.subject + " (Copy)", topics: scheduler.topics, total_days: scheduler.total_days })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    await fetchSchedulers();
    toast({ title: "Scheduler duplicated" });
    return data as Scheduler;
  };

  return { schedulers, loading, createScheduler, deleteScheduler, renameScheduler, duplicateScheduler, refetch: fetchSchedulers };
}

export function useSchedulerDetail(schedulerId: string) {
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const [days, setDays] = useState<SchedulerDay[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    if (!user || !schedulerId) return;
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from("schedulers").select("*").eq("id", schedulerId).single(),
      supabase.from("scheduler_days").select("*").eq("scheduler_id", schedulerId).order("day_number"),
    ]);
    if (s) setScheduler(s as Scheduler);
    if (d) setDays(d as SchedulerDay[]);
    setLoading(false);
  }, [user, schedulerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertDay = async (dayData: Partial<SchedulerDay> & { scheduler_id: string; day_number: number }) => {
    const { data, error } = await supabase
      .from("scheduler_days")
      .upsert(dayData, { onConflict: "scheduler_id,day_number" })
      .select()
      .single();
    if (error) throw error;
    setDays(prev => {
      const idx = prev.findIndex(d => d.day_number === dayData.day_number);
      if (idx >= 0) { const next = [...prev]; next[idx] = data as SchedulerDay; return next; }
      return [...prev, data as SchedulerDay].sort((a, b) => a.day_number - b.day_number);
    });
    return data as SchedulerDay;
  };

  const updateScheduler = async (updates: Partial<Scheduler>) => {
    const { data, error } = await supabase.from("schedulers").update(updates).eq("id", schedulerId).select().single();
    if (error) throw error;
    setScheduler(data as Scheduler);
    return data as Scheduler;
  };

  const saveQuestions = async (dayId: string, questions: Omit<SchedulerQuestion, "id" | "created_at">[]) => {
    // Delete old questions for this day
    await supabase.from("scheduler_questions").delete().eq("scheduler_day_id", dayId);
    const { data, error } = await supabase.from("scheduler_questions").insert(
      questions.map(q => ({ ...q, scheduler_day_id: dayId }))
    ).select();
    if (error) throw error;
    return data as SchedulerQuestion[];
  };

  const submitQuizAnswer = async (questionId: string, answer: number) => {
    const { error } = await supabase.from("scheduler_questions").update({ user_answer: answer }).eq("id", questionId);
    if (error) throw error;
  };

  /** Unlock a specific day number (used for calendar-day-change unlock) */
  const unlockDay = async (dayNumber: number) => {
    if (!scheduler) return;
    await supabase.from("scheduler_days")
      .upsert(
        { scheduler_id: schedulerId, day_number: dayNumber, is_unlocked: true },
        { onConflict: "scheduler_id,day_number" }
      );
    await fetchAll();
  };

  const completeDay = async (dayId: string, correct: number, attempted: number) => {
    if (!scheduler) return;
    const unlock = correct >= 3;
    const nextDay = scheduler.current_day + 1;

    // Update current day
    await supabase.from("scheduler_days").update({
      is_completed: true,
      questions_correct: correct,
      questions_attempted: attempted,
    }).eq("id", dayId);

    // Always unlock next day on completion (quiz passed) 
    if (unlock && nextDay <= scheduler.total_days) {
      await supabase.from("scheduler_days")
        .upsert(
          { scheduler_id: schedulerId, day_number: nextDay, is_unlocked: true },
          { onConflict: "scheduler_id,day_number" }
        );
    }

    if (unlock) {
      const newStreak = scheduler.streak + 1;
      const isCompleted = nextDay > scheduler.total_days;
      await supabase.from("schedulers").update({
        current_day: Math.min(nextDay, scheduler.total_days),
        streak: newStreak,
        is_completed: isCompleted,
      }).eq("id", schedulerId);
    }

    await fetchAll();
    return unlock;
  };

  return { scheduler, days, loading, upsertDay, updateScheduler, saveQuestions, submitQuizAnswer, completeDay, unlockDay, refetch: fetchAll };
}
