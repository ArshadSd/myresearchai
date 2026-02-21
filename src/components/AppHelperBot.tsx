import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";

type BotMessage = { role: "user" | "bot"; content: string };

const COMMANDS: { patterns: RegExp[]; action: string; response: string }[] = [
  { patterns: [/go\s*to\s*profile/i, /open\s*profile/i, /profile\s*page/i, /my\s*profile/i], action: "/profile", response: "Taking you to your Profile! 👤" },
  { patterns: [/go\s*to\s*dashboard/i, /open\s*dashboard/i, /home/i, /dashboard/i], action: "/", response: "Navigating to Dashboard! 🏠" },
  { patterns: [/go\s*to\s*documents/i, /open\s*documents/i, /my\s*docs/i, /documents?\s*page/i], action: "/documents", response: "Opening Documents! 📄" },
  { patterns: [/go\s*to\s*analytics/i, /open\s*analytics/i, /analytics\s*(section|page)?/i, /stats/i], action: "/analytics", response: "Heading to Analytics! 📊" },
  { patterns: [/go\s*to\s*chat/i, /open\s*chat/i, /new\s*chat/i, /start\s*chat/i], action: "/chat", response: "Opening a new Chat! 💬" },
  { patterns: [/light\s*mode/i, /switch.*light/i, /theme.*light/i], action: "theme:light", response: "Switched to Light mode! ☀️" },
  { patterns: [/dark\s*mode/i, /switch.*dark/i, /theme.*dark/i], action: "theme:dark", response: "Switched to Dark mode! 🌙" },
];

const HELP_TEXT = `I can help you navigate! Try:
• "Go to profile"
• "Open documents"
• "Go to analytics"
• "Switch to light mode"
• "Go to dashboard"`;

export function AppHelperBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([
    { role: "bot", content: "Hi! I'm your app assistant. Ask me to navigate anywhere or change settings! 🤖" },
  ]);
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    let matched = false;
    for (const cmd of COMMANDS) {
      if (cmd.patterns.some((p) => p.test(text))) {
        matched = true;
        setTimeout(() => {
          setMessages((prev) => [...prev, { role: "bot", content: cmd.response }]);
          if (cmd.action.startsWith("theme:")) {
            const desired = cmd.action.split(":")[1];
            if (theme !== desired) toggleTheme();
          } else {
            navigate(cmd.action);
          }
        }, 300);
        break;
      }
    }

    if (!matched) {
      if (/help/i.test(text) || /what\s*can/i.test(text)) {
        setTimeout(() => setMessages((prev) => [...prev, { role: "bot", content: HELP_TEXT }]), 300);
      } else {
        setTimeout(() => setMessages((prev) => [...prev, { role: "bot", content: "I didn't understand that. Type \"help\" to see what I can do! 😊" }]), 300);
      }
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center neon-glow-cyan"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 w-80 h-[420px] glass-strong rounded-2xl border border-border/50 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-primary/5">
              <Bot className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold flex-1">App Assistant</span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-2 border-t border-border/30 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Try 'go to profile'..."
                className="text-xs h-8"
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!input.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
