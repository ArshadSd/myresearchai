import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek
} from "date-fns";
import { ChevronLeft, ChevronRight, Brain, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchedulers } from "@/hooks/useSchedulers";
import { cn } from "@/lib/utils";

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { schedulers, loading } = useSchedulers();
  const navigate = useNavigate();

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Map schedulers to date ranges
  const schedulerEvents = useMemo(() => {
    return schedulers.map((s) => {
      const start = new Date(s.created_at);
      const end = new Date(start);
      end.setDate(end.getDate() + s.total_days - 1);
      return { ...s, startDate: start, endDate: end };
    });
  }, [schedulers]);

  const getSchedulersForDay = (day: Date) => {
    return schedulerEvents.filter((s) => {
      const dayOnly = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const startOnly = new Date(s.startDate.getFullYear(), s.startDate.getMonth(), s.startDate.getDate());
      const endOnly = new Date(s.endDate.getFullYear(), s.endDate.getMonth(), s.endDate.getDate());
      return dayOnly >= startOnly && dayOnly <= endOnly;
    });
  };

  const colors = [
    "bg-primary/20 text-primary border-primary/30",
    "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "bg-rose-500/20 text-rose-400 border-rose-500/30",
    "bg-violet-500/20 text-violet-400 border-violet-500/30",
  ];

  const getColor = (idx: number) => colors[idx % colors.length];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your learning schedule at a glance
          </p>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
      >
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-border/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const daySchedulers = getSchedulersForDay(day);

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] p-1.5 border-b border-r border-border/20 transition-colors",
                  !inMonth && "opacity-30",
                  today && "bg-primary/5"
                )}
              >
                <div className={cn(
                  "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                  today && "bg-primary text-primary-foreground"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {daySchedulers.slice(0, 3).map((s, si) => {
                    const colorIdx = schedulerEvents.findIndex((se) => se.id === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => navigate("/scheduler")}
                        className={cn(
                          "w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate font-medium hover:opacity-80 transition-opacity",
                          getColor(colorIdx)
                        )}
                        title={s.subject}
                      >
                        {s.subject}
                      </button>
                    );
                  })}
                  {daySchedulers.length > 3 && (
                    <span className="text-[10px] text-muted-foreground pl-1">
                      +{daySchedulers.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Legend */}
      {schedulers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {schedulerEvents.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border",
                getColor(i)
              )}
            >
              <Brain className="h-3 w-3" />
              <span className="font-medium">{s.subject}</span>
              <span className="opacity-60">
                {format(s.startDate, "MMM d")} – {format(s.endDate, "MMM d")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && schedulers.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <div>
            <p className="text-muted-foreground">No schedulers yet</p>
            <Button variant="link" onClick={() => navigate("/scheduler")} className="mt-1">
              Create your first learning journey →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
