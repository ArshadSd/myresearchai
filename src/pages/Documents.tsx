import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Upload, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Documents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDocs(data || []);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (id: string, filePath: string) => {
    await supabase.storage.from("documents").remove([filePath]);
    await supabase.from("documents").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "Deleted", description: "Document removed" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Documents</h1>
          <p className="text-muted-foreground">Your uploaded research papers</p>
        </div>
        <Button onClick={() => navigate("/chat?action=upload")} className="gap-2">
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass border-border/30 p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <Card className="glass border-border/30 p-12 flex flex-col items-center text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No documents yet. Upload your first PDF to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc, i) => (
            <motion.div key={doc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="glass border-border/30 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-primary/60 shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)}KB` : ""}
                    </p>
                    {doc.extracted_text && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.extracted_text.slice(0, 150)}...</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {doc.conversation_id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/chat?id=${doc.conversation_id}`)}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(doc.id, doc.file_path)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
