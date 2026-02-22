import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, FileText, MessageSquare, Clock, Flame, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Analytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ docs: 0, chats: 0, events: 0, streak: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [feedbackData, setFeedbackData] = useState({ total: 0, helpful: 0, notHelpful: 0, ratio: 0 });
  const [feedbackTrend, setFeedbackTrend] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch stats
    const fetchStats = async () => {
      const [docsRes, chatsRes, eventsRes] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      // Calculate streak from analytics events
      const { data: events } = await supabase
        .from("analytics_events")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      let streak = 0;
      if (events && events.length > 0) {
        const days = new Set(events.map((e) => new Date(e.created_at).toDateString()));
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (days.has(d.toDateString())) streak++;
          else break;
        }
      }

      setStats({
        docs: docsRes.count || 0,
        chats: chatsRes.count || 0,
        events: eventsRes.count || 0,
        streak,
      });

      // Build chart data from last 7 days
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const day = d.toLocaleDateString("en", { weekday: "short" });
        const dayStr = d.toDateString();
        const dayEvents = events?.filter((e) => new Date(e.created_at).toDateString() === dayStr) || [];
        last7.push({ day, activity: dayEvents.length, docs: 0 });
      }

      // Get docs per day
      const { data: recentDocs } = await supabase
        .from("documents")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

      if (recentDocs) {
        recentDocs.forEach((doc) => {
          const dayStr = new Date(doc.created_at).toDateString();
          const entry = last7.find((l) => {
            const d = new Date();
            for (let i = 6; i >= 0; i--) {
              const dd = new Date();
              dd.setDate(dd.getDate() - i);
              if (dd.toDateString() === dayStr && l.day === dd.toLocaleDateString("en", { weekday: "short" })) return true;
            }
            return false;
          });
          if (entry) entry.docs++;
        });
      }

      setChartData(last7);

      // Fetch feedback data
      const { data: feedbacks } = await supabase
        .from("feedback")
        .select("helpful, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (feedbacks && feedbacks.length > 0) {
        const helpfulCount = feedbacks.filter((f) => f.helpful).length;
        const notHelpfulCount = feedbacks.length - helpfulCount;
        setFeedbackData({
          total: feedbacks.length,
          helpful: helpfulCount,
          notHelpful: notHelpfulCount,
          ratio: Math.round((helpfulCount / feedbacks.length) * 100),
        });

        // Build 7-day feedback trend
        const trend = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayStr = d.toDateString();
          const day = d.toLocaleDateString("en", { weekday: "short" });
          const dayFeedbacks = feedbacks.filter((f) => new Date(f.created_at).toDateString() === dayStr);
          const up = dayFeedbacks.filter((f) => f.helpful).length;
          const down = dayFeedbacks.length - up;
          trend.push({ day, helpful: up, notHelpful: down });
        }
        setFeedbackTrend(trend);
      }
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { icon: FileText, label: "Documents Analyzed", value: stats.docs, color: "text-primary" },
    { icon: MessageSquare, label: "Chat Sessions", value: stats.chats, color: "text-accent" },
    { icon: Flame, label: "Daily Streak", value: `${stats.streak}d`, color: "text-neon-yellow" },
    { icon: BarChart3, label: "Total Events", value: stats.events, color: "text-neon-green" },
    { icon: ThumbsUp, label: "Feedback Score", value: feedbackData.total > 0 ? `${feedbackData.ratio}%` : "N/A", color: "text-primary" },
  ];

  const pieData = feedbackData.total > 0 ? [
    { name: "Helpful", value: feedbackData.helpful },
    { name: "Not Helpful", value: feedbackData.notHelpful },
  ] : [];
  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-1">Analytics</h1>
        <p className="text-muted-foreground">Your research activity overview</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass border-border/30">
              <CardContent className="p-5">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-3`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Chat Activity (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="activity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents Uploaded (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line type="monotone" dataKey="docs" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Feedback Analytics */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Chatbot Feedback & Improvement
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="glass border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Feedback Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feedbackData.helpful} helpful</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-destructive" />
                      <span className="text-sm">{feedbackData.notHelpful} not helpful</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{feedbackData.total} total ratings</p>
                    <p className="text-lg font-bold text-primary">{feedbackData.ratio}% satisfaction</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No feedback data yet. Rate AI responses to see insights.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="glass border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Feedback Trend (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {feedbackTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={feedbackTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="helpful" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Helpful" />
                    <Bar dataKey="notHelpful" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Not Helpful" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No feedback trend data yet.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {feedbackData.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card className="glass border-border/30">
            <CardContent className="p-5">
              <p className="text-sm font-medium mb-2">🤖 AI Improvement Status</p>
              <p className="text-xs text-muted-foreground">
                {feedbackData.ratio >= 80
                  ? "✅ Your chatbot is performing well! The AI system prompt is optimized based on your positive feedback patterns."
                  : feedbackData.ratio >= 50
                  ? "⚠️ Mixed feedback detected. The AI is automatically adjusting its response style to be more concise, structured, and direct."
                  : "🔧 Low satisfaction detected. The AI has been reconfigured to prioritize clarity, brevity, and direct answers. Keep rating to improve further."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default Analytics;
