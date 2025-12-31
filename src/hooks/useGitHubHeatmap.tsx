import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface GitHubHeatmapResponse {
  username?: string;
  contributions?: ContributionDay[];
  error?: string;
  fallback?: boolean;
}

export const useGitHubHeatmap = (username: string, year?: number) => {
  const [data, setData] = useState<ContributionDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!username || username.trim().length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchHeatmap = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(
          `[useGitHubHeatmap] Fetching heatmap for ${username} in year ${year ?? "current"}`,
        );

        const { data: response, error: fnError } =
          await supabase.functions.invoke<GitHubHeatmapResponse>("github-heatmap", {
            body: { username, year },
          });

        console.log(`[useGitHubHeatmap] Response:`, response, `Error:`, fnError);

        if (fnError) {
          console.warn(`[useGitHubHeatmap] Function error for ${username}:`, fnError);
          setUseFallback(true);
          setData(null);
          setError(fnError.message);
        } else if (!response) {
          console.warn(`[useGitHubHeatmap] No response for ${username}`);
          setUseFallback(true);
          setData(null);
        } else if (response.fallback || response.error || !response.contributions) {
          console.warn(`[useGitHubHeatmap] Fallback response for ${username}:`, response.error);
          setUseFallback(true);
          setData(null);
          setError(response.error ?? null);
        } else {
          console.log(
            `[useGitHubHeatmap] Success! Got ${response.contributions.length} days for ${username}`,
          );
          setData(response.contributions);
          setUseFallback(false);
        }
      } catch (err) {
        console.error(`[useGitHubHeatmap] Fetch error for ${username}:`, err);
        setUseFallback(true);
        setData(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, [username, year]);

  return { data, loading, error, useFallback };
};
