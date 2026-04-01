import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Link2, FileText, Clock, GitCompareArrows } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("documents")
      .select("id, title, created_at, file_size, conversation_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setRecentDocs(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-bold mb-1">Welcome back</h1>
        <p className="text-muted-foreground">What would you like to research today?</p>
      </motion.div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card
            className="glass cursor-pointer group hover:border-primary/50 transition-all duration-300 border-border/50"
            onClick={() => navigate("/chat?action=upload")}
          >
            <CardContent className="flex items-center gap-5 p-6">
              <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upload Document</h3>
                <p className="text-sm text-muted-foreground">Upload a PDF and start analyzing</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card
            className="glass cursor-pointer group hover:border-accent/50 transition-all duration-300 border-border/50"
            onClick={() => navigate("/chat?action=compare")}
          >
            <CardContent className="flex items-center gap-5 p-6">
              <div className="p-4 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <GitCompareArrows className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Compare 2 Documents</h3>
                <p className="text-sm text-muted-foreground">Upload 2 documents for comparison</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card
            className="glass cursor-pointer group hover:neon-glow-cyan transition-all duration-300 border-border/50"
            onClick={() => navigate("/chat?action=url")}
          >
            <CardContent className="flex items-center gap-5 p-6">
              <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Link2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Paste URL</h3>
                <p className="text-sm text-muted-foreground">Analyze a webpage with safety check</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Documents */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Recent Documents</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="glass border-border/30 p-4 flex items-center gap-3 opacity-50">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-1/3 rounded bg-muted animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
        ) : recentDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Upload your first document to get started</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocs.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card
                  className="glass border-border/30 p-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => doc.conversation_id && navigate(`/chat?id=${doc.conversation_id}`)}
                >
                  <FileText className="h-8 w-8 text-primary/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)}KB` : ""}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
