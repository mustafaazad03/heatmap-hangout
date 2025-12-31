import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeatmapScene } from "@/components/scene/HeatmapScene";
import { useWorldPresence } from "@/hooks/useWorldPresence";
import { useGitHubHeatmap } from "@/hooks/useGitHubHeatmap";
import { useStreak } from "@/hooks/useStreak";
import { useAuth } from "@/contexts/AuthContext";
import { useWorldChat } from "@/hooks/useWorldChat";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatLabel = (name: string) => (name.length > 7 ? `${name.slice(0, 7)}…` : name);

const COLS = 32;
const ROWS = 7;
const TILE_SIZE = 0.9;
const OFFSET_X = -COLS / 2;
const OFFSET_Z = -ROWS / 2;

const UserWorld = () => {
  const { username: rawUsername } = useParams();
  const navigate = useNavigate();
  const username = (rawUsername ?? "").trim();
  const { user } = useAuth();
  const { streak } = useStreak();

  const [year, setYear] = useState(new Date().getFullYear());
  const [pos, setPos] = useState({ x: 0, z: 0 });
  const [spawnedOnTerrain, setSpawnedOnTerrain] = useState(false);
  const [movement, setMovement] = useState({ moving: false, running: false, heading: 0, speed: 0 });
  const [anonLabels, setAnonLabels] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const displayName = useMemo(() => "You", []);

  useEffect(() => {
    if (!username) {
      navigate("/", { replace: true });
      return;
    }
    document.title = `${username} – HeatMap Hangout`;
  }, [username, navigate]);

  const { peers, selfId } = useWorldPresence({
    username,
    displayName,
    x: pos.x,
    z: pos.z,
  });

  const { data: contributions, loading: heatmapLoading, useFallback } = useGitHubHeatmap(
    username,
    year,
  );

  const { messages: chatMessages, sendMessage: sendChatMessage } = useWorldChat({
    username,
    displayName,
  });

  const terrainLevels = useMemo(() => {
    if (!contributions || contributions.length === 0) return null;

    const weekMap = new Map<number, Map<number, { level: number }>>();

    contributions.forEach((day) => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();
      const weekOfYear = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );

      if (!weekMap.has(weekOfYear)) {
        weekMap.set(weekOfYear, new Map());
      }
      weekMap.get(weekOfYear)!.set(dayOfWeek, { level: day.level });
    });

    const weeks = Array.from(weekMap.keys()).sort((a, b) => b - a);
    const sampled = weeks.slice(0, COLS);

    const grid: number[][] = Array.from({ length: COLS }, () => Array(ROWS).fill(0));

    for (let x = 0; x < COLS; x++) {
      const weekIdx = sampled[COLS - 1 - x];
      const weekData = weekMap.get(weekIdx);

      for (let z = 0; z < ROWS; z++) {
        const day = weekData?.get(z);
        grid[x][z] = day?.level ?? 0;
      }
    }

    return grid;
  }, [contributions]);

  useEffect(() => {
    // When terrain changes, respawn once on a strong tile
    if (!terrainLevels || spawnedOnTerrain) return;

    let bestX = 0;
    let bestZ = 0;
    let bestLevel = 0;

    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < ROWS; z++) {
        const level = terrainLevels[x][z] ?? 0;
        if (level > bestLevel) {
          bestLevel = level;
          bestX = x;
          bestZ = z;
        }
      }
    }

    if (bestLevel > 0) {
      const worldX = OFFSET_X + bestX * TILE_SIZE;
      const worldZ = OFFSET_Z + bestZ * TILE_SIZE;
      setPos({ x: worldX, z: worldZ });
    }

    setSpawnedOnTerrain(true);
  }, [terrainLevels, spawnedOnTerrain]);

  useEffect(() => {
    const pressed = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        setChatOpen(true);
        // focus chat input shortly after opening
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 0);
        return;
      }
      pressed.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase());
    };

    const getTileLevelAt = (x: number, z: number) => {
      if (!terrainLevels) return 1; // allow free roaming when using fallback terrain

      const ix = Math.round((x - OFFSET_X) / TILE_SIZE);
      const iz = Math.round((z - OFFSET_Z) / TILE_SIZE);

      if (ix < 0 || ix >= COLS || iz < 0 || iz >= ROWS) return 0;
      return terrainLevels[ix][iz] ?? 0;
    };

    const step = (deltaSeconds: number) => {
      if (pressed.size === 0) {
        setMovement((prev) => ({
          ...prev,
          moving: false,
          running: false,
          speed: prev.speed * 0.8,
        }));
        return;
      }

      setPos((current) => {
        let { x, z } = current;
        const running = pressed.has("shift");
        const speedPerSecond = running ? 3.5 : 2.0;
        const distance = speedPerSecond * deltaSeconds;

        const forward = pressed.has("w") || pressed.has("arrowup");
        const backward = pressed.has("s") || pressed.has("arrowdown");
        const left = pressed.has("a") || pressed.has("arrowleft");
        const right = pressed.has("d") || pressed.has("arrowright");

        const isMoving = forward || backward || left || right;
        if (!isMoving) {
          setMovement((prev) => ({ ...prev, moving: false, running: false, speed: 0 }));
          return current;
        }

        const prevX = x;
        const prevZ = z;

        let nextX = x;
        let nextZ = z;

        if (forward) nextZ -= distance;
        if (backward) nextZ += distance;
        if (left) nextX -= distance;
        if (right) nextX += distance;

        const clampedX = clamp(nextX, -18, 18);
        const clampedZ = clamp(nextZ, -6, 6);

        const currentLevel = getTileLevelAt(x, z);
        const targetLevel = getTileLevelAt(clampedX, clampedZ);

        // Block movement outside terrain or on zero-contribution tiles
        if (targetLevel === 0) {
          setMovement((prev) => ({ ...prev, moving: false, running: false, speed: 0 }));
          return current;
        }

        // Require jump (space) to move onto higher tiles
        const wantsJump = pressed.has(" ") || pressed.has("space");
        if (targetLevel > currentLevel && !wantsJump) {
          setMovement((prev) => ({ ...prev, moving: false, running: false, speed: 0 }));
          return current;
        }

        const dx = clampedX - prevX;
        const dz = clampedZ - prevZ;
        const desiredHeading = Math.atan2(dx, dz);
        const frameSpeed = Math.sqrt(dx * dx + dz * dz) / Math.max(deltaSeconds, 0.0001);

        setMovement((prev) => {
          const hasMovement = Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001;
          const targetHeading = hasMovement ? desiredHeading : prev.heading;
          const deltaHeading = ((targetHeading - prev.heading + Math.PI) % (2 * Math.PI)) - Math.PI;
          const maxStep = 0.25; // limit how fast we can turn per frame to avoid jitter
          const clampedDelta = clamp(deltaHeading, -maxStep, maxStep);
          const smoothedHeading = prev.heading + clampedDelta;
          const smoothedSpeed = prev.speed + (frameSpeed - prev.speed) * 0.35;

          return {
            ...prev,
            moving: true,
            running,
            heading: smoothedHeading,
            speed: smoothedSpeed,
          };
        });

        return {
          x: clampedX,
          z: clampedZ,
        };
      });
    };

    let lastTime = performance.now();
    let frameId: number;

    const loop = (time: number) => {
      const deltaMs = time - lastTime;
      lastTime = time;
      const deltaSeconds = Math.min(deltaMs / 1000, 0.05); // clamp to avoid big jumps

      step(deltaSeconds);
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [terrainLevels]);

  useEffect(() => {
    if (!peers || peers.length === 0) return;

    setAnonLabels((current) => {
      const updated = { ...current };
      let nextIndex = Object.values(updated).length + 1;

      for (const peer of peers) {
        if (peer.id === selfId) continue; // never label self
        if (!updated[peer.id]) {
          updated[peer.id] = `Dev ${nextIndex++}`;
        }
      }

      // Avoid unnecessary state updates
      if (Object.keys(updated).length === Object.keys(current).length) {
        return current;
      }

      return updated;
    });
  }, [peers, selfId]);

  const otherPeers = useMemo(
    () =>
      peers
        .filter((p) => p.id !== selfId)
        .map((p) => ({
          ...p,
          name: formatLabel(anonLabels[p.id] ?? "Dev"),
        })),
    [peers, selfId, anonLabels],
  );

  const allPeers = [
    {
      id: "self",
      name: formatLabel("You"),
      x: pos.x,
      z: pos.z,
      isMoving: movement.moving,
      isRunning: movement.running,
      heading: movement.heading,
      speed: movement.speed,
    },
    ...otherPeers,
  ];

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
          <div className="flex items-center gap-3 text-xs md:text-sm">
            <span className="hidden md:inline text-muted-foreground">/{username}</span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col md:flex-row">
        <section className="relative h-[60vh] flex-1 md:h-auto">
          {heatmapLoading ? (
            <div className="flex h-full items-center justify-center bg-muted/20 text-xs text-muted-foreground">
              Loading terrain from GitHub…
            </div>
          ) : (
            <HeatmapScene username={username} peers={allPeers} contributions={contributions} />
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
            <div className="pointer-events-auto rounded-sm border border-border bg-background/90 px-4 py-2 text-xs shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Controls</p>
              <p className="mt-1 text-xs">
                WASD / Arrows walk, hold Shift to run, Space to climb higher tiles · Press / to open chat
              </p>
            </div>
          </div>
        </section>

        <aside className="border-t border-border bg-muted/40 md:w-[320px] md:border-l md:border-t-0">
          <div className="h-full space-y-4 p-4 md:p-6">
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold uppercase tracking-[0.18em]">Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  You&apos;re wandering through <span className="font-mono">/{username}</span>&apos;s commit
                  landscape
                  {useFallback && " (procedurally generated)"}.
                </p>
                <p className="text-xs text-muted-foreground">
                  Viewing contributions from {year}-01-01 (start) to {year}-12-31 (end).
                </p>
                <p className="text-xs text-muted-foreground">
                  {useFallback
                    ? "GitHub data unavailable. Showing a seeded fallback terrain."
                    : "Each hill is a high-commit day. Flat valleys mark quiet focus time."}
                </p>
                {user && streak && (
                  <div className="mt-2 rounded-sm border border-dashed border-border bg-accent/40 p-2 text-xs">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Your streak
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {streak.current_streak} {streak.current_streak === 1 ? "day" : "days"} ·
                      <span className="text-muted-foreground"> record {streak.max_streak}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Avatar skin: {streak.current_streak >= 30
                        ? "Mythic wanderer"
                        : streak.current_streak >= 14
                          ? "Epic explorer"
                          : streak.current_streak >= 7
                            ? "Rare climber"
                            : streak.current_streak >= 3
                              ? "Uncommon walker"
                              : "Default"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold uppercase tracking-[0.18em]">
                  Devs online
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {allPeers.length === 0 ? (
                  <p className="text-muted-foreground">You&apos;re the first to arrive in this world.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {allPeers.map((peer) => (
                      <li key={peer.id} className="flex items-center justify-between gap-2">
                        <span className="max-w-[80px] truncate whitespace-nowrap font-mono text-[10px]">
                          {formatLabel(peer.name)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          ({peer.x.toFixed(1)}, {peer.z.toFixed(1)})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold uppercase tracking-[0.18em]">
                  World chat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {chatMessages.length === 0 ? (
                    <p className="text-muted-foreground">No messages yet. Press / to start talking.</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <p key={msg.id} className="truncate">
                        <span className="font-mono text-[10px] text-muted-foreground">[{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]</span>
                        <span className="mx-1 font-mono text-[10px] text-muted-foreground">{msg.senderName}:</span>
                        <span>{msg.text}</span>
                      </p>
                    ))
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    ref={chatInputRef}
                    placeholder="Type a message and press Enter…"
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const value = (e.target as HTMLInputElement).value;
                        if (value.trim()) {
                          sendChatMessage(value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setChatOpen(false);
                      }
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Messages auto-expire after 2 minutes. Only the latest 8 messages are shown.
                </p>
              </CardContent>
            </Card>

            <Button
              variant="outline"
              className="w-full border-dashed text-xs uppercase tracking-[0.2em]"
              onClick={() => navigate("/")}
            >
              Back to lobby
            </Button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default UserWorld;
