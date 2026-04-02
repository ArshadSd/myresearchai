import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Flame, Trophy, Trash2, Copy, ArrowRight, CheckCircle2, Pencil } from "lucide-react";
import { Scheduler } from "@/hooks/useSchedulers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  scheduler: Scheduler;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (newName: string) => void;
}

export function SchedulerCard({ scheduler, onOpen, onDelete, onDuplicate, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(scheduler.subject);

  const progress = scheduler.is_completed
    ? 100
    : Math.round(((scheduler.current_day - 1) / scheduler.total_days) * 100);

  const daysLeft = scheduler.total_days - (scheduler.current_day - 1);

  const handleRename = () => {
    if (name.trim() && name.trim() !== scheduler.subject) {
      onRename(name.trim());
    }
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl border border-border/50 p-5 hover:border-primary/30 transition-all group cursor-pointer"
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {scheduler.is_completed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                <Trophy className="h-3 w-3" /> Completed
              </span>
            )}
            {!scheduler.is_completed && scheduler.streak > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium">
                <Flame className="h-3 w-3" /> {scheduler.streak} streak
              </span>
            )}
          </div>
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setName(scheduler.subject); setEditing(false); } }}
              onClick={(e) => e.stopPropagation()}
              className="h-8 text-sm font-semibold"
              autoFocus
            />
          ) : (
            <h3 className="font-semibold text-base truncate">{scheduler.subject}</h3>
          )}
          {scheduler.topics && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{scheduler.topics}</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Day {scheduler.current_day} of {scheduler.total_days}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              scheduler.is_completed
                ? "bg-green-500"
                : "bg-gradient-to-r from-primary to-cyan-400"
            )}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {scheduler.is_completed ? "All days done" : `${daysLeft} days left`}
        </span>
        {scheduler.is_completed && (
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> Journey complete
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          {scheduler.is_completed ? "Review" : "Continue"} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0 hover:border-destructive/50 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
