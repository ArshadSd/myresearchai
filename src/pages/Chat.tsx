import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Brain, Loader2, Mic, Volume2, Paperclip, Link2, X,
  Upload, FileText, Shield, ShieldAlert, ShieldCheck, Languages,
  Download, FilePlus2, ThumbsUp, ThumbsDown, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useMessages, type Message } from "@/hooks/useMessages";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/streamChat";
import { generateChatPdf } from "@/lib/generatePdf";
import { FeedbackModal } from "@/components/FeedbackModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Always returns the current user's JWT — falls back to anon key only if no session */
async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

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
  const navigate = useNavigate();
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
  const [documentName, setDocumentName] = useState<string | null>(null);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, "up" | "down">>({});

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
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);

  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const prevConvRef = useRef<string | null>(null);

  // Track analytics event
  const trackEvent = useCallback(async (eventType: string, eventData?: any) => {
    if (!user) return;
    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: eventType,
      event_data: eventData || {},
    });
  }, [user]);

  // Load messages when conversation changes
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Restore document context when switching to a conversation that has a document
  useEffect(() => {
    if (!conversationId || !user) {
      setDocumentContext(null);
      setDocumentName(null);
      return;
    }
    supabase
      .from("documents")
      .select("extracted_text, title")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].extracted_text) {
          setDocumentContext(data[0].extracted_text);
          setDocumentName(data[0].title);
        } else {
          setDocumentContext(null);
          setDocumentName(null);
        }
      });
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show feedback when leaving a conversation that had messages
  useEffect(() => {
    if (prevConvRef.current && prevConvRef.current !== conversationId && messages.length > 0) {
      setShowFeedback(true);
    }
    prevConvRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (action === "upload") { setShowUploadModal(true); }
    if (action === "url") { setShowUrlModal(true); }
    if (action === "compare") { setShowUploadModal(true); setTimeout(() => multiFileInputRef.current?.click(), 300); }
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
    trackEvent("chat_message");

    let assistantContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    const ctx = overrideContext || documentContext || undefined;
    // Domain mode: include all user documents as context
    let domainCtx = ctx;
    if ((window as any).__domainMode && !ctx && user) {
      const { data: docs } = await supabase
        .from("documents")
        .select("extracted_text")
        .eq("user_id", user.id)
        .not("extracted_text", "is", null)
        .limit(5);
      if (docs && docs.length > 0) {
        domainCtx = docs.map((d) => d.extracted_text).join("\n\n---\n\n");
      }
    }

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
        documentContext: domainCtx,
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
      const filePath = `${user!.id}/${Date.now()}_${file.name}`;
      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      setUploadProgress(50);

      const formData = new FormData();
      formData.append("file", file);
      const extractRes = await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
        body: formData,
      });
      const extractData = await extractRes.json();
      setUploadProgress(75);

      if (!extractData.success) throw new Error(extractData.error || "Extraction failed");

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
      setDocumentName(file.name);
      setShowUploadModal(false);
      trackEvent("document_upload", { filename: file.name });

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

  // ─── Multi-doc comparison ───
  const handleMultiUpload = async (files: FileList) => {
    if (files.length !== 2) {
      toast({ title: "Select exactly 2 PDFs", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const texts: string[] = [];
      const names: string[] = [];

      for (let i = 0; i < 2; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error(`${file.name} is not a PDF`);
        names.push(file.name);

        const filePath = `${user!.id}/${Date.now()}_${file.name}`;
        await supabase.storage.from("documents").upload(filePath, file);
        setUploadProgress(20 + i * 25);

        const formData = new FormData();
        formData.append("file", file);
        const extractRes = await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf`, {
          method: "POST",
          headers: { Authorization: `Bearer ${await getAuthToken()}` },
          body: formData,
        });
        const extractData = await extractRes.json();
        if (!extractData.success) throw new Error(`Failed to extract ${file.name}`);
        texts.push(extractData.text || "");

        await supabase.from("documents").insert({
          user_id: user!.id,
          title: file.name,
          file_path: filePath,
          file_size: file.size,
          extracted_text: extractData.text?.slice(0, 50000) || "",
        });
      }

      setUploadProgress(80);
      setShowUploadModal(false);

      const combinedCtx = `Document 1: "${names[0]}"\n${texts[0]}\n\n---\n\nDocument 2: "${names[1]}"\n${texts[1]}`;
      setDocumentContext(combinedCtx);
      trackEvent("multi_doc_comparison");

      await handleSend(
        `I've uploaded 2 documents for comparison: "${names[0]}" and "${names[1]}". Please compare them with a structured analysis covering: 1) Algorithms used, 2) Evaluation metrics, 3) Results. Present the comparison in a clear table format.`,
        combinedCtx
      );

      toast({ title: "Comparison started", description: "Analyzing both documents..." });
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
    if (e.dataTransfer.files.length === 2) {
      handleMultiUpload(e.dataTransfer.files);
    } else if (e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // ─── URL Scrape ───
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setIsScrapingUrl(true);
    setUrlSafety(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.safety) setUrlSafety(data.safety);

      if (!data.success) {
        if (data.error) toast({ title: "Scrape failed", description: data.error, variant: "destructive" });
        return;
      }
      // If score < 90, block — show safety meter only, don't proceed
      if (data.safety && data.safety.score < 90) {
        toast({ title: "🚫 Unsafe URL", description: "This URL is flagged as malware — unsafe to open", variant: "destructive" });
        return;
      }

      // Safe — auto-analyse
      setDocumentContext(data.text);
      setShowUrlModal(false);
      setUrlInput("");
      trackEvent("url_scrape", { url: urlInput });

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

  // ─── Translation ───
  const handleTranslate = async (msgIdx: number, lang: string) => {
    setTranslatingIdx(msgIdx);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
        body: JSON.stringify({ text: messages[msgIdx].content, targetLang: lang }),
      });
      const data = await res.json();
      if (data.success && data.translated) {
        setMessages((prev) => prev.map((m, i) => (i === msgIdx ? { ...m, content: data.translated } : m)));
        toast({ title: "Translated", description: `Translated to ${LANGUAGES.find((l) => l.value === lang)?.label}` });
      } else {
        toast({ title: "Translation failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Translation error", variant: "destructive" });
    } finally {
      setTranslatingIdx(null);
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

  // ─── Feedback ───
  const handleFeedback = async (helpful: boolean) => {
    if (!user || !prevConvRef.current) return;
    await supabase.from("feedback").insert({
      user_id: user.id,
      conversation_id: prevConvRef.current,
      helpful,
    });
    setShowFeedback(false);
    toast({ title: "Thanks for your feedback!" });
  };

  // ─── PDF Export ───
  const handleExportPdf = () => {
    if (messages.length === 0) return;
    generateChatPdf(messages, `Chat Export - ${new Date().toLocaleDateString()}`);
    trackEvent("pdf_export");
  };

  // ─── Image Upload & Analysis ───
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 10MB for images", variant: "destructive" });
      return;
    }

    const activeConvId = await ensureConversation(`🖼️ Image Analysis`);
    if (!activeConvId) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const userMsg: Message = { role: "user", content: `[Uploaded image: ${file.name}] Analyze this image in detail.` };
      setMessages((prev) => [...prev, userMsg]);
      await saveMessage(userMsg);
      setIsLoading(true);
      trackEvent("image_analysis", { filename: file.name });

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
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat-vision`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getAuthToken()}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMsg],
            imageBase64: base64,
            imageMimeType: file.type,
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          toast({ title: "Vision Error", description: data.error || "Failed", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const rdr = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await rdr.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) upsert(content);
            } catch { /* skip */ }
          }
        }

        setIsLoading(false);
        if (assistantContent) {
          await saveMessage({ role: "assistant", content: assistantContent });
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setIsLoading(false);
          toast({ title: "Error", description: "Image analysis failed", variant: "destructive" });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // ─── Per-message feedback ───
  const handleMsgFeedback = async (msgIdx: number, helpful: boolean) => {
    setFeedbackGiven((prev) => ({ ...prev, [msgIdx]: helpful ? "up" : "down" }));
    if (user && conversationId) {
      await supabase.from("feedback").insert({
        user_id: user.id,
        conversation_id: conversationId,
        helpful,
        message_content: messages[msgIdx]?.content?.slice(0, 500) || "",
        message_index: msgIdx,
      });
    }
    toast({ title: helpful ? "Thanks! Glad it helped 👍" : "Thanks for the feedback 👎" });
    trackEvent("message_feedback", { msgIdx, helpful });
  };

  const isSafeUrl = urlSafety && urlSafety.score >= 90;

  const SafetyMeter = ({ safety }: { safety: { score: number; level: string; flags: string[] } }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-3">
      {safety.score >= 90 ? (
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-neon-green" />
          <span className="text-sm font-medium text-neon-green">✅ Safe — This URL looks safe to analyse</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <span className="text-sm font-bold text-destructive">🚫 Malware URL — Unsafe to open</span>
          </div>
          {safety.flags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {safety.flags.map((f, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{f}</span>
              ))}
            </div>
          )}
          <p className="text-xs text-destructive/80">This URL has been flagged as potentially dangerous. Do not open or analyse this link.</p>
        </div>
      )}
    </motion.div>
  );

  return (
    <div
      className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto"
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith("image/")) handleImageUpload(file);
        else if (file?.name.endsWith(".pdf")) handleFileUpload(file);
      }}
    >
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
      <input ref={multiFileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length === 2) handleMultiUpload(e.target.files); }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="glass-strong border-border/30">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border/50"}`}
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
                <p className="text-xs text-muted-foreground mb-4">Drop 2 PDFs for comparison · up to 30MB each</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <FileText className="h-4 w-4 mr-2" /> Single PDF
                  </Button>
                  <Button onClick={() => multiFileInputRef.current?.click()} variant="outline">
                    <FilePlus2 className="h-4 w-4 mr-2" /> Compare 2 Documents
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Modal */}
      <Dialog open={showUrlModal} onOpenChange={setShowUrlModal}>
        <DialogContent className="glass-strong border-border/30">
          <DialogHeader><DialogTitle>Paste URL</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com/article" className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()} />
              <Button onClick={handleUrlSubmit} disabled={!urlInput.trim() || isScrapingUrl}>
                {isScrapingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
            {isScrapingUrl && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking safety & scraping content...
              </motion.div>
            )}
            {urlSafety && <SafetyMeter safety={urlSafety} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} onFeedback={handleFeedback} />

      {/* Messages */}
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
            <div className="flex gap-3 flex-wrap justify-center">
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
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "glass border-border/30 rounded-bl-md"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
              {msg.role === "assistant" && msg.content && (
                <div className="flex gap-1 mt-2 pt-2 border-t border-border/20 items-center">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleTTS(msg.content)}>
                    <Volume2 className="h-3 w-3" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={translatingIdx === i}>
                        {translatingIdx === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {LANGUAGES.map((lang) => (
                        <DropdownMenuItem key={lang.value} onClick={() => handleTranslate(i, lang.value)}>
                          {lang.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${feedbackGiven[i] === "up" ? "text-green-500" : "text-muted-foreground"}`}
                      onClick={() => handleMsgFeedback(i, true)}
                      disabled={!!feedbackGiven[i]}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${feedbackGiven[i] === "down" ? "text-destructive" : "text-muted-foreground"}`}
                      onClick={() => handleMsgFeedback(i, false)}
                      disabled={!!feedbackGiven[i]}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
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

      {/* Input */}
      <div className="glass-strong rounded-2xl p-3 border-border/30">
        {documentContext && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {documentName ? `📄 ${documentName}` : "Document context loaded"}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => { setDocumentContext(null); setDocumentName(null); }}>
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
           <Button variant="ghost" size="icon" className={`shrink-0 ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground"}`} onClick={handleSTT}>
            <Mic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => imageInputRef.current?.click()} title="Upload image for analysis">
            <ImageIcon className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={handleExportPdf} title="Export as PDF">
              <Download className="h-4 w-4" />
            </Button>
          )}
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
