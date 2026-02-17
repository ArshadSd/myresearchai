import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, MessageSquare, FileText, BarChart3, User, LogOut,
  Plus, ChevronLeft, ChevronRight, Brain, MoreHorizontal,
  Pin, Star, Tag, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: User, label: "Profile", path: "/profile" },
];

const tagOptions = [
  { label: "Research", value: "research", color: "bg-yellow-500" },
  { label: "Exam", value: "exam", color: "bg-blue-500" },
  { label: "Interview", value: "interview", color: "bg-green-500" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signOut } = useAuth();
  const { conversations, loading, updateConversation, deleteConversation } = useConversations();

  const activeConvId = searchParams.get("id");

  const handleNewChat = () => {
    navigate("/chat");
  };

  const handleOpenChat = (id: string) => {
    navigate(`/chat?id=${id}`);
  };

  const sortedConvos = [...conversations].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
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

      {/* New Chat */}
      <div className="p-3">
        <Button
          onClick={handleNewChat}
          className={cn("w-full gap-2 neon-glow-cyan", collapsed && "px-0 justify-center")}
          size={collapsed ? "icon" : "default"}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "New Chat"}
        </Button>
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

      {/* Nav Items (when collapsed, show all; when expanded, show non-chat nav) */}
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
  );
}
