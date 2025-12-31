import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUsername, sanitizeChatMessage } from "@/lib/utils";

export interface WorldChatMessage {
  id: string;
  senderName: string;
  text: string;
  createdAt: number;
}

interface UseWorldChatOptions {
  username: string;
  displayName: string;
}

export const useWorldChat = ({ username, displayName }: UseWorldChatOptions) => {
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Helper: apply retention rules (max 8 messages, drop older than 2 minutes)
  const applyRetention = (items: WorldChatMessage[]): WorldChatMessage[] => {
    const now = Date.now();
    const fresh = items.filter((m) => now - m.createdAt <= 2 * 60 * 1000);
    return fresh.slice(-8);
  };

  useEffect(() => {
    // Sanitize username before using in channel names to prevent channel name injection attacks
    const sanitizedUsername = sanitizeUsername(username);
    if (!sanitizedUsername) {
      console.warn("[useWorldChat] Invalid username, skipping channel creation");
      return;
    }

    const channel = supabase.channel(`chat:${sanitizedUsername}`, {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on("broadcast", { event: "message" }, (payload: { payload: WorldChatMessage }) => {
        const msg = payload.payload as WorldChatMessage;
        setMessages((prev) => applyRetention([...prev, msg]));
      })
      .subscribe();

    channelRef.current = channel;

    // Periodic cleanup in case some old messages linger
    const interval = window.setInterval(() => {
      setMessages((current) => applyRetention(current));
    }, 15_000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.clearInterval(interval);
    };
  }, [username]);

  const sendMessage = async (text: string) => {
    if (!channelRef.current) return;

    // Message Validation: Maximum message length (500 chars), block empty messages
    // Strip HTML/script tags from messages
    const sanitized = sanitizeChatMessage(text, 500);
    if (!sanitized || sanitized.length === 0) {
      return;
    }

    const message: WorldChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderName: displayName,
      text: sanitized,
      createdAt: Date.now(),
    };

    await channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });
  };

  return { messages, sendMessage };
};
