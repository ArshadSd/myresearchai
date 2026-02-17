import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Brain, Loader2, Mic, Volume2, Paperclip, Link2, X,
  Upload, FileText, Shield, ShieldAlert, ShieldCheck, Languages
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMessages, type Message } from "@/hooks/useMessages";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "te", label: "Telugu" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "es", label: "Spanish" },
  { value: "ja", label: "Japanese" },
];

const Chat = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("id");
  const action = searchParams.get("action");
  const { user } = useAuth();
  const { messages, setMessages, loadMessages, saveMessage } = useMessages(conversationId);
  const { createConversation, updateConversation } = useConversations();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // URL states
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [urlSafety, setUrlSafety] = useState<{ score: number; level: string; flags: string[] } | null>(null);

  // Translation
  const [showTranslation, setShowTranslation] = useState(false);
  const [translateLang, setTranslateLang] = useState("en");

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Open modals based on URL action param
  useEffect(() => {
    if (action === "upload") setShowUploadModal(true);
    if (action === "url") setShowUrlModal(true);
  }, [action]);

  const ensureConversation = async (title: string) => {
    if (conversationId) return conversationId;
    const conv = await createConversation(title);
    if (!conv) {
      toast({ title: "Error", description: "Failed to create chat", variant: "destructive" });
      return null;
    }
    setSearchParams({ id: conv.id }, { replace: true });
    return conv.id;
  };

  const handleSend = async (overrideInput?: string, overrideContext?: string) => {
    const text = (overrideInput || input).trim();
    if (!text || isLoading) return;
    if (!overrideInput) setInput("");

    const activeConvId = await ensureConversation(text.slice(0, 60));
    if (!activeConvId) return;

    if (messages.length === 0 && !overrideInput) {
      await updateConversation(activeConvId, { title: text.slice(0, 60) });
    }

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    await saveMessage(userMsg);
    setIsLoading(true);

    let assistantContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    const upsert = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        documentContext: overrideContext || documentContext || undefined,
        onDelta: upsert,
        onDone: async () => {
          setIsLoading(false);
          if (assistantContent) {
            await saveMessage({ role: "assistant", content: assistantContent });
          }
        },
        onError: (err) => {
          setIsLoading(false);
          toast({ title: "AI Error", description: err, variant: "destructive" });
        },
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setIsLoading(false);
        toast({ title: "Error", description: "Failed to get response", variant: "destructive" });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── PDF Upload ───
  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please upload a PDF file", variant: "destructive" });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 30MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Step 1: Upload to storage
      const filePath = `${user!.id}/${Date.now()}_${file.name}`;
      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      setUploadProgress(50);

      // Step 2: Extract text via edge function
      const formData = new FormData();
      formData.append("file", file);

      const extractRes = await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
        body: formData,
      });

      const extractData = await extractRes.json();
      setUploadProgress(75);

      if (!extractData.success) throw new Error(extractData.error || "Extraction failed");

      // Step 3: Create conversation and store document
      const convId = await ensureConversation(`📄 ${file.name}`);
      if (!convId) return;

      await supabase.from("documents").insert({
        user_id: user!.id,
        title: file.name,
        file_path: filePath,
        file_size: file.size,
        extracted_text: extractData.text?.slice(0, 50000) || "",
        conversation_id: convId,
      });

      setUploadProgress(100);
      setDocumentContext(extractData.text);
      setShowUploadModal(false);

      // Auto-send first message
      await handleSend(
        `I've uploaded a document: "${file.name}". Please provide a brief summary of the key points.`,
        extractData.text
      );

      toast({ title: "Document uploaded", description: `${file.name} is ready for analysis` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // ─── URL Scrape ───
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setIsScrapingUrl(true);
    setUrlSafety(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();

      if (data.safety) setUrlSafety(data.safety);

      if (!data.success) {
        if (data.error) toast({ title: "Scrape failed", description: data.error, variant: "destructive" });
        setIsScrapingUrl(false);
        return;
      }

      if (data.safety?.level === "danger") {
        toast({ title: "⚠️ Unsafe URL", description: "This URL has been flagged as potentially dangerous", variant: "destructive" });
        setIsScrapingUrl(false);
        return;
      }

      // Create chat with URL content
      setDocumentContext(data.text);
      setShowUrlModal(false);
      setUrlInput("");

      await handleSend(
        `I've loaded a webpage: "${data.title}" (${data.url}). Please provide a summary of the main content.`,
        data.text
      );

      toast({ title: "URL loaded", description: `${data.title} is ready for analysis` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsScrapingUrl(false);
    }
  };

  // ─── TTS / STT ───
  const handleTTS = (text: string) => {
    if (isSpeaking) { speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    speechSynthesis.speak(u);
  };

  const handleSTT = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Not Supported", description: "Speech recognition not available", variant: "destructive" }); return; }
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onresult = (e: any) => setInput((p) => p + e.results[0][0].transcript);
    r.onerror = () => setIsListening(false);
    r.start();
  };

  const SafetyMeter = ({ safety }: { safety: { score: number; level: string; flags: string[] } }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-3">
      <div className="flex items-center gap-2">
        {safety.level === "safe" && <ShieldCheck className="h-5 w-5 text-green-500" />}
        {safety.level === "caution" && <Shield className="h-5 w-5 text-yellow-500" />}
        {safety.level === "danger" && <ShieldAlert className="h-5 w-5 text-red-500" />}
        <span className={`text-sm font-medium ${
          safety.level === "safe" ? "text-green-500" : safety.level === "caution" ? "text-yellow-500" : "text-red-500"
        }`}>
          Safety: {safety.score}% — {safety.level === "safe" ? "Safe" : safety.level === "caution" ? "Caution" : "Dangerous"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safety.score}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full rounded-full ${
            safety.level === "safe" ? "bg-green-500" : safety.level === "caution" ? "bg-yellow-500" : "bg-red-500"
          }`}
        />
      </div>
      {safety.flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {safety.flags.map((f, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{f}</span>
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
      />

      {/* ─── Upload Modal ─── */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="glass-strong border-border/30">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Processing document...</p>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
              </motion.div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Drag & drop your PDF here</p>
                <p className="text-xs text-muted-foreground mb-4">or click to browse (up to 30MB)</p>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  <FileText className="h-4 w-4 mr-2" /> Choose PDF
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── URL Modal ─── */}
      <Dialog open={showUrlModal} onOpenChange={setShowUrlModal}>
        <DialogContent className="glass-strong border-border/30">
          <DialogHeader>
            <DialogTitle>Paste URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />
              <Button onClick={handleUrlSubmit} disabled={!urlInput.trim() || isScrapingUrl}>
                {isScrapingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
            {isScrapingUrl && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking safety & scraping content...
              </motion.div>
            )}
            {urlSafety && <SafetyMeter safety={urlSafety} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-auto space-y-4 py-4 px-2">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 rounded-2xl bg-primary/10 mb-4 neon-glow-cyan">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">How can I help?</h2>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              Ask questions, upload documents, or paste a URL to start researching.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setShowUploadModal(true)}>
                <Upload className="h-4 w-4" /> Upload PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowUrlModal(true)}>
                <Link2 className="h-4 w-4" /> Paste URL
              </Button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "glass border-border/30 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
              {msg.role === "assistant" && msg.content && (
                <div className="flex gap-1 mt-2 pt-2 border-t border-border/20">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleTTS(msg.content)}>
                    <Volume2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTranslation(!showTranslation)}>
                    <Languages className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3 border-border/30">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ─── Input ─── */}
      <div className="glass-strong rounded-2xl p-3 border-border/30">
        {documentContext && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Document context loaded</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setDocumentContext(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setShowUploadModal(true)}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setShowUrlModal(true)}>
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={`shrink-0 ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
            onClick={handleSTT}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your research..."
            className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] max-h-32"
            rows={1}
          />
          <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading} size="icon" className="shrink-0 rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
