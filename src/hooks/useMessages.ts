import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Message = { role: "user" | "assistant"; content: string };

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
    setLoading(false);
  }, [conversationId, user]);

  const saveMessage = async (msg: Message) => {
    if (!conversationId || !user) return;
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: msg.role,
      content: msg.content,
    });
    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  };

  return { messages, setMessages, loading, loadMessages, saveMessage };
}
