import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStreak } from "@/hooks/useStreak";
import { sanitizeUsername } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { streak } = useStreak();
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"anon" | "named">("anon");

  useEffect(() => {
    document.title = "HeatMap Hangout – 3D GitHub contribution worlds";
  }, []);

  const handleEnter = () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    // Sanitize username before using in channel names (alphanumeric, hyphens, underscores only)
    const sanitized = sanitizeUsername(trimmed);
    if (!sanitized || sanitized.length === 0) {
      return; // Invalid username format
    }

    // If mode is named and not logged in, redirect to auth
    if (mode === "named" && !user) {
      navigate("/auth");
      return;
    }

    navigate(`/${sanitized}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-baseline gap-2 font-mono text-sm uppercase tracking-[0.2em]">
            <span className="rounded-sm border border-border bg-muted px-2 py-1 shadow-2xs">HeatMap</span>
            <span>Hangout</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-muted-foreground md:block">Relaxing 3D social worlds for commit-obsessed devs.</p>
            {!authLoading && user && (
              <Button variant="outline" size="sm" onClick={handleSignOut} className="text-xs">
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container flex flex-1 flex-col items-center justify-center py-10">
        <div className="grid w-full gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
          <section className="space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Multiplayer · Zen · 3D</p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                Walk through your GitHub heatmap with friends.
              </h1>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
                Type any GitHub handle to spawn a cozy 3D terrain from their contribution calendar.
                Stroll the hills of green squares, chat by pressing <span className="font-mono">/</span>, and unwind after deploys.
              </p>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-sm border border-border bg-muted px-2 py-1 font-mono shadow-xs">60fps</span>
              <span className="rounded-sm border border-border bg-muted px-2 py-1 font-mono shadow-xs">Up to 50 devs</span>
            </div>

            <div className="mt-6 flex w-full flex-col gap-3 rounded-md border border-dashed border-border bg-muted/40 p-4 shadow-xs md:flex-row md:items-center">
              <label className="flex-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                /[github username]
                <Input
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="octocat"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEnter();
                  }}
                  className="mt-2 font-mono text-sm"
                />
              </label>

              <div className="flex flex-col gap-2 md:w-52">
                <div className="flex gap-2 text-[11px] font-mono uppercase tracking-[0.18em]">
                  <button
                    type="button"
                    onClick={() => setMode("anon")}
                    className={`flex-1 rounded-sm border px-2 py-1 shadow-xs ${mode === "anon" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    Anon
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("named");
                      if (!user) {
                        navigate("/auth");
                      }
                    }}
                    className={`flex-1 rounded-sm border px-2 py-1 shadow-xs ${mode === "named" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    Named {user && "✓"}
                  </button>
                </div>
                <Button
                  onClick={handleEnter}
                  className="w-full justify-between rounded-sm border border-border bg-primary px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] shadow-sm hover:bg-primary/90"
                >
                  Enter world
                  <span className="text-[10px] text-primary-foreground/80">/{username || "octocat"}</span>
                </Button>
              </div>
            </div>

            <p className="mt-2 max-w-md text-[11px] text-muted-foreground">
              Realtime multiplayer, chat, streak-based skins, and ambient soundscapes are wired through the backend and
              rolling out in phases. This is your lobby.
            </p>

            {user && streak && (
              <div className="mt-4 rounded-sm border border-dashed border-border bg-accent/40 p-3 text-xs shadow-xs">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Your streak
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {streak.current_streak} {streak.current_streak === 1 ? "day" : "days"} ·{" "}
                  <span className="text-muted-foreground">record {streak.max_streak}</span>
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.18em]">
                  How it feels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Imagine Figma FigJam, but floating above a soft 3D reconstruction of your commit history.
                </p>
                <p>
                  No leaderboards, no pressure—just devs wandering commit peaks, dropping thoughts, and decompressing
                  after long sessions.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.18em]">
                  Roadmap vibes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>&bull; Pull real GitHub contribution heatmaps per user</p>
                <p>&bull; Socket-style realtime movement + chat via the backend</p>
                <p>&bull; Daily visit streaks unlocking avatar skins and trails</p>
                <p>&bull; Per-world ambient music</p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
