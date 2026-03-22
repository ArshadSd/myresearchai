import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Brain, Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot";

const Auth = () => {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Google Sign-In Failed", description: error.message, variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Apple Sign-In Failed", description: error.message, variant: "destructive" });
    } finally {
      setAppleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        toast({ title: "Check your email", description: "We've sent a verification link to your email." });
        setMode("login");
      } else {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast({ title: "Reset link sent", description: "Check your email for a password reset link." });
        setMode("login");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        <div className="glass-strong rounded-2xl p-8 neon-glow-cyan">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="p-2.5 rounded-xl bg-primary/10 neon-glow-cyan">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">Research AI</h1>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {mode === "forgot" && (
                <button onClick={() => setMode("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back to login
                </button>
              )}

              <h2 className="text-xl font-semibold mb-1">
                {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {mode === "login" ? "Sign in to continue your research" : mode === "signup" ? "Start your research journey" : "We'll send you a reset link"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="name" placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-10 bg-secondary/50 border-border/50" />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary/50 border-border/50" />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary/50 border-border/50" />
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                </Button>
              </form>

              {mode !== "forgot" && (
                <>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background/80 px-2 text-muted-foreground">or continue with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-secondary/50 border-border/50 hover:bg-secondary"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    {googleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    Continue with Google
                  </Button>
                </>
              )}

              <div className="mt-6 text-center text-sm">
                {mode === "login" && (
                  <>
                    <button onClick={() => setMode("forgot")} className="text-primary hover:underline">Forgot password?</button>
                    <p className="mt-2 text-muted-foreground">
                      Don't have an account?{" "}
                      <button onClick={() => setMode("signup")} className="text-primary hover:underline">Sign up</button>
                    </p>
                  </>
                )}
                {mode === "signup" && (
                  <p className="text-muted-foreground">
                    Already have an account?{" "}
                    <button onClick={() => setMode("login")} className="text-primary hover:underline">Sign in</button>
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
