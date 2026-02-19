import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, Mail, Camera, Lock, Star, Pin, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConversations } from "@/hooks/useConversations";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { conversations } = useConversations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [feedback, setFeedback] = useState<{ helpful: number; notHelpful: number }>({ helpful: 0, notHelpful: 0 });

  useEffect(() => {
    if (!user) return;
    // Load profile
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || "");
          setAvatarUrl(data.avatar_url || "");
        }
      });

    // Load feedback stats
    supabase
      .from("feedback")
      .select("helpful")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setFeedback({
            helpful: data.filter((f) => f.helpful).length,
            notHelpful: data.filter((f) => !f.helpful).length,
          });
        }
      });
  }, [user]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = urlData.publicUrl + `?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    toast({ title: "Avatar updated" });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    setSaving(false);
    toast({ title: "Profile saved" });
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setNewPassword("");
    }
    setChangingPw(false);
  };

  const starredChats = conversations.filter((c) => c.is_starred);
  const pinnedChats = conversations.filter((c) => c.is_pinned);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-1">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </motion.div>

      {/* Avatar & Name */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass border-border/30">
          <CardHeader><CardTitle className="text-lg">Account Info</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }} />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Display Name</Label>
                <div className="flex gap-2">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                  <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-accent/10">
                <Mail className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="glass border-border/30">
          <CardHeader><CardTitle className="text-lg">Change Password</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={handleChangePassword} disabled={changingPw}>
                {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Feedback History */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass border-border/30">
          <CardHeader><CardTitle className="text-lg">Feedback History</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-green-500" />
                <span className="text-lg font-semibold">{feedback.helpful}</span>
                <span className="text-sm text-muted-foreground">Helpful</span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-5 w-5 text-red-500" />
                <span className="text-lg font-semibold">{feedback.notHelpful}</span>
                <span className="text-sm text-muted-foreground">Not Helpful</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Starred & Pinned */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="glass border-border/30">
          <CardHeader><CardTitle className="text-lg">Starred & Pinned Chats</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {starredChats.length === 0 && pinnedChats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No starred or pinned chats yet</p>
            ) : (
              <>
                {pinnedChats.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
                {starredChats.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Profile;
