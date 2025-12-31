import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign In – HeatMap Hangout";
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Validation error",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              display_name: displayName.trim() || email.split("@")[0],
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          // Create profile
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: data.user.id,
            display_name: displayName.trim() || email.split("@")[0],
            avatar_color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
          });

          if (profileError) console.warn("Profile creation error:", profileError);

          // Create streak record
          const today = new Date().toISOString().split("T")[0];
          const { error: streakError } = await supabase.from("streaks").insert({
            user_id: data.user.id,
            current_streak: 1,
            max_streak: 1,
            last_visit: today,
          });

          if (streakError) console.warn("Streak creation error:", streakError);

          toast({
            title: "Account created!",
            description: "You're now signed in. Welcome to HeatMap Hangout.",
          });
          navigate("/", { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Signed in successfully",
          description: "Welcome back!",
        });
        navigate("/", { replace: true });
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Auth error:", err);
      toast({
        title: mode === "signup" ? "Signup failed" : "Login failed",
        description: err.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-baseline gap-2 font-mono text-sm uppercase tracking-[0.2em]"
          >
            <span className="rounded-sm border border-border bg-muted px-2 py-1 shadow-2xs">HeatMap</span>
            <span>Hangout</span>
          </button>
        </div>
      </header>

      <main className="container flex flex-1 items-center justify-center py-10">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold uppercase tracking-[0.18em]">
              {mode === "signup" ? "Create account" : "Sign in"}
            </CardTitle>
            <CardDescription>
              {mode === "signup"
                ? "Join HeatMap Hangout as a named user. Track your daily visit streaks and unlock avatar skins."
                : "Sign in to your named account to access your streak data and unlocks."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <label htmlFor="displayName" className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Display name (optional)
                  </label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="octocat"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="dev@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-sm border border-border bg-primary px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] shadow-sm hover:bg-primary/90"
              >
                {submitting ? "Processing…" : mode === "signup" ? "Sign up" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-medium underline hover:text-foreground"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-medium underline hover:text-foreground"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
