import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, CalendarDays, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchedulers } from "@/hooks/useSchedulers";
import { SchedulerCard } from "@/components/scheduler/SchedulerCard";
import { CreateSchedulerModal } from "@/components/scheduler/CreateSchedulerModal";
import { SchedulerDetail } from "@/components/scheduler/SchedulerDetail";
import { useToast } from "@/hooks/use-toast";

export default function Scheduler() {
  const { schedulers, loading, createScheduler, deleteScheduler, duplicateScheduler } = useSchedulers();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSchedulerId, setActiveSchedulerId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreate = async (subject: string, topics: string, days: number) => {
    const s = await createScheduler(subject, topics, days);
    if (s) {
      toast({ title: "🚀 Journey created!", description: `${days}-day plan for "${subject}" is ready.` });
      setActiveSchedulerId(s.id);
    }
  };

  if (activeSchedulerId) {
    return (
      <SchedulerDetail
        schedulerId={activeSchedulerId}
        onBack={() => setActiveSchedulerId(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduler</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Adaptive learning journeys — earn your way forward
          </p>
        </div>
        {schedulers.length > 0 && (
          <Button onClick={() => setModalOpen(true)} className="gap-2 neon-glow-cyan">
            <Plus className="h-4 w-4" /> New Journey
          </Button>
        )}
      </div>

      {/* Empty State */}
      {!loading && schedulers.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 space-y-6 text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-12 w-12 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-cyan-500" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Your journey starts here</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
              Create a scheduler and let AI design a day-by-day progression. Earn your way forward by proving mastery — no skipping ahead.
            </p>
          </div>
          <Button size="lg" onClick={() => setModalOpen(true)} className="gap-2 neon-glow-cyan px-8">
            <Plus className="h-5 w-5" /> Create Scheduler
          </Button>
        </motion.div>
      )}

      {/* Cards Grid */}
      {schedulers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {schedulers.map((s) => (
              <SchedulerCard
                key={s.id}
                scheduler={s}
                onOpen={() => setActiveSchedulerId(s.id)}
                onDelete={() => deleteScheduler(s.id)}
                onDuplicate={() => duplicateScheduler(s)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateSchedulerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
