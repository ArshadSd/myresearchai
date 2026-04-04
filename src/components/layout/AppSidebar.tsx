import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, MessageSquare, FileText, BarChart3, User, LogOut,
  Plus, ChevronLeft, ChevronRight, Brain, MoreHorizontal,
  Pin, Star, Tag, Trash2, CalendarDays, Share2, Import, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: CalendarDays, label: "Scheduler", path: "/scheduler" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: User, label: "Profile", path: "/profile" },
  { icon: Crown, label: "Upgrade", path: "/pricing" },
];

const tagOptions = [
  { label: "Research", value: "research", color: "bg-yellow-500" },
  { label: "Exam", value: "exam", color: "bg-blue-500" },
  { label: "Interview", value: "interview", color: "bg-green-500" },
];

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importToken, setImportToken] = useState("");
  const [importing, setImporting] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { signOut } = useAuth();
  const { conversations, loading, updateConversation, deleteConversation, refetch } = useConversations();
  const { toast } = useToast();

  const activeConvId = searchParams.get("id");

  const handleNewChat = () => navigate("/chat");
  const handleOpenChat = (id: string) => navigate(`/chat?id=${id}`);

  const handleShareChat = async (convId: string) => {
    if (!user) return;
    const token = generateToken();
    const { error } = await supabase.from("shared_chats").insert({
      token,
      conversation_id: convId,
      user_id: user.id,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to create share link", variant: "destructive" });
      return;
    }
    setShareToken(token);
    toast({ title: "Share token created", description: "Copy the token and share it" });
  };

  const handleImportChat = async () => {
    if (!importToken.trim() || !user) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-chat", {
        body: { token: importToken.trim() },
      });

      if (error || data?.error) {
        toast({ title: "Import failed", description: data?.error || error?.message || "Invalid token", variant: "destructive" });
        setImporting(false);
        return;
      }

      setShowImportModal(false);
      setImportToken("");
      refetch();
      navigate(`/chat?id=${data.conversation.id}`);
      toast({ title: "Chat imported!", description: `"${data.conversation.title}" added to your chats` });
    } catch {
      toast({ title: "Error", description: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleCopyToken = () => {
    if (shareToken) {
      navigator.clipboard.writeText(shareToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sortedConvos = [...conversations].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.2 }}
        className="h-screen flex flex-col glass-strong border-r border-border/50 relative z-10"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border/30">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-lg text-gradient whitespace-nowrap">
              Research AI
            </motion.span>
          )}
        </div>

        {/* New Chat + Import */}
        <div className="p-3 space-y-2">
          <Button
            onClick={handleNewChat}
            className={cn("w-full gap-2", collapsed && "px-0 justify-center")}
            size={collapsed ? "icon" : "default"}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && "New Chat"}
          </Button>
          {!collapsed && (
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="w-full gap-2"
              size="default"
            >
              <Import className="h-4 w-4" />
              Import Chat
            </Button>
          )}
        </div>

        {/* Chat History */}
        {!collapsed && (
          <div className="flex-1 overflow-auto px-2 space-y-0.5">
            <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">Chats</p>
            <AnimatePresence>
              {sortedConvos.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer transition-all relative",
                    activeConvId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                  onClick={() => handleOpenChat(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1 text-xs">{conv.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {conv.is_pinned && <Pin className="h-2.5 w-2.5 text-muted-foreground/60" />}
                    {conv.is_starred && <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />}
                    {conv.tag && (
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        conv.tag === "research" && "bg-yellow-500",
                        conv.tag === "exam" && "bg-blue-500",
                        conv.tag === "interview" && "bg-green-500",
                      )} />
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary/80 transition-opacity">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateConversation(conv.id, { is_pinned: !conv.is_pinned }); }}>
                        <Pin className="h-3.5 w-3.5 mr-2" /> {conv.is_pinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateConversation(conv.id, { is_starred: !conv.is_starred }); }}>
                        <Star className="h-3.5 w-3.5 mr-2" /> {conv.is_starred ? "Unstar" : "Star"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareChat(conv.id); }}>
                        <Share2 className="h-3.5 w-3.5 mr-2" /> Share
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger><Tag className="h-3.5 w-3.5 mr-2" /> Tag</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {tagOptions.map((t) => (
                            <DropdownMenuItem key={t.value} onClick={(e) => { e.stopPropagation(); updateConversation(conv.id, { tag: conv.tag === t.value ? null : t.value }); }}>
                              <span className={cn("h-2.5 w-2.5 rounded-full mr-2", t.color)} />
                              {t.label} {conv.tag === t.value && "✓"}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); if (activeConvId === conv.id) navigate("/chat"); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Nav Items */}
        <nav className={cn("px-3 space-y-1", collapsed ? "flex-1" : "")}>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
          {collapsed && (
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
            >
              <Import className="h-4.5 w-4.5 shrink-0" />
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/30">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 p-1 rounded-full bg-card border border-border shadow-md hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </motion.aside>

      {/* Import Chat Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="glass-strong border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5 text-primary" />
              Import Shared Chat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the share token to import a chat into your account.
            </p>
            <div className="flex gap-2">
              <Input
                value={importToken}
                onChange={(e) => setImportToken(e.target.value)}
                placeholder="Paste share token here..."
                onKeyDown={(e) => e.key === "Enter" && handleImportChat()}
              />
              <Button onClick={handleImportChat} disabled={!importToken.trim() || importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Token Modal */}
      <Dialog open={!!shareToken} onOpenChange={() => { setShareToken(null); setCopied(false); }}>
        <DialogContent className="glass-strong border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share Token
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this token with others. They can use "Import Chat" to add this conversation to their account.
            </p>
            <div className="flex gap-2">
              <Input value={shareToken || ""} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyToken}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
