import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUsername } from "@/lib/utils";

export interface WorldPeerState {
  id: string;
  name: string;
  x: number;
  z: number;
}

interface UseWorldPresenceOptions {
  username: string;
  displayName: string;
  x: number;
  z: number;
}

export const useWorldPresence = ({ username, displayName, x, z }: UseWorldPresenceOptions) => {
  const [peers, setPeers] = useState<WorldPeerState[]>([]);
  const [ready, setReady] = useState(false);
  const lastSentRef = useRef<{ x: number; z: number; time: number } | null>(null);

  const presenceKey = useMemo(() => {
    const anonSuffix = Math.random().toString(36).slice(2, 8);
    return `guest-${anonSuffix}`;
  }, []);

  useEffect(() => {
    // Sanitize username before using in channel names to prevent channel name injection attacks
    const sanitizedUsername = sanitizeUsername(username);
    if (!sanitizedUsername) {
      console.warn("[useWorldPresence] Invalid username, skipping channel creation");
      return;
    }

    const channel = supabase.channel(`world:${sanitizedUsername}`, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name: string; x: number; z: number }>>;
        const next: WorldPeerState[] = [];

        Object.entries(state).forEach(([id, entries]) => {
          entries.forEach((entry) => {
            next.push({ id, name: entry.name, x: entry.x, z: entry.z });
          });
        });

        setPeers(next);
      })
      .on("presence", { event: "join" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name: string; x: number; z: number }>>;
        const next: WorldPeerState[] = [];

        Object.entries(state).forEach(([id, entries]) => {
          entries.forEach((entry) => {
            next.push({ id, name: entry.name, x: entry.x, z: entry.z });
          });
        });

        setPeers(next);
      })
      .on("presence", { event: "leave" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name: string; x: number; z: number }>>;
        const next: WorldPeerState[] = [];

        Object.entries(state).forEach(([id, entries]) => {
          entries.forEach((entry) => {
            next.push({ id, name: entry.name, x: entry.x, z: entry.z });
          });
        });

        setPeers(next);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setReady(true);
          await channel.track({ name: displayName, x, z });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username, presenceKey, displayName, x, z]);

  useEffect(() => {
    if (!ready) return;

    // Sanitize username before using in channel names
    const sanitizedUsername = sanitizeUsername(username);
    if (!sanitizedUsername) return;

    const channel = supabase.channel(`world:${sanitizedUsername}`);

    const now = performance.now();
    const last = lastSentRef.current ?? { x, z, time: 0 };
    const dx = x - last.x;
    const dz = z - last.z;
    const distSq = dx * dx + dz * dz;

    // Throttle presence updates: only send when movement is noticeable
    // or at least every 150ms to keep other clients smooth.
    if (distSq < 0.0001 && now - last.time < 150) {
      return () => {
        supabase.removeChannel(channel);
      };
    }

    lastSentRef.current = { x, z, time: now };
    channel.track({ name: displayName, x, z }).catch(() => undefined);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username, displayName, x, z, ready]);

  return { peers, selfId: presenceKey };
};
