import { motion } from "framer-motion";
import { BarChart3, FileText, MessageSquare, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  { icon: FileText, label: "Documents Analyzed", value: "0", color: "text-primary" },
  { icon: MessageSquare, label: "Chat Sessions", value: "0", color: "text-accent" },
  { icon: Clock, label: "Hours Researched", value: "0", color: "text-neon-green" },
  { icon: BarChart3, label: "Daily Streak", value: "0", color: "text-neon-yellow" },
];

const Analytics = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-1">Analytics</h1>
        <p className="text-muted-foreground">Your research activity overview</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
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

      <Card className="glass border-border/30 p-8">
        <p className="text-center text-muted-foreground">Charts will appear as you use the app</p>
      </Card>
    </div>
  );
};

export default Analytics;
