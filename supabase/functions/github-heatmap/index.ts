import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request body size (prevent DoS)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 1024) {
      return new Response(
        JSON.stringify({ error: "Request body too large", fallback: true }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { username, year: rawYear } = await req.json();

    // Validate username exists and is a string
    if (!username || typeof username !== "string" || username.trim().length === 0) {
      console.error("[github-heatmap] Missing username");
      return new Response(
        JSON.stringify({ error: "username is required", fallback: true }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sanitizedUsername = username.trim();
    const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_-]{0,37}[a-zA-Z0-9])?$/;
    
    if (sanitizedUsername.length > 39 || !usernameRegex.test(sanitizedUsername)) {
      console.error(`[github-heatmap] Invalid username format: ${sanitizedUsername}`);
      return new Response(
        JSON.stringify({ error: "Invalid username format", fallback: true }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Determine which year to fetch; default to current year if not provided
    const currentYear = new Date().getFullYear();
    let year = currentYear;

    if (typeof rawYear === "number" && Number.isFinite(rawYear)) {
      const minYear = 2008;
      const maxYear = currentYear;
      year = Math.min(maxYear, Math.max(minYear, Math.trunc(rawYear)));
    }

    console.log(`[github-heatmap] Fetching contributions for: ${sanitizedUsername} in year ${year}`);

    // Use GitHub Contributions API by Jonas Gruber.
    // Docs: https://github-contributions-api.jogruber.de
    const apiUrl = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(
      sanitizedUsername,
    )}?y=${year}`;
    console.log(`[github-heatmap] Fetching contributions from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "heatmap-hangout-github-heatmap-edge-function",
      },
    });

    if (!response.ok) {
      // Treat upstream errors as a soft failure so the frontend can fall back
      const text = await response.text();
      console.error(
        `[github-heatmap] Upstream API error for ${sanitizedUsername}: ${response.status} ${response.statusText} - ${text}`,
      );
      return new Response(
        JSON.stringify({
          error: `Upstream contributions API error (status: ${response.status})`,
          fallback: true,
        }),
        {
          // Return 200 so the client library does not surface this as a hard error
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const json = await response.json();
    console.log(
      `[github-heatmap] Raw API payload keys:`,
      Object.keys(json),
      `Total map:`,
      json.total,
    );

    // Expected shape from github-contributions-api.jogruber.de:
    // {
    //   total: { [year: string]: number },
    //   contributions: [{ date: string, count: number, level: 0-4 }, ...]
    // }
    const raw = Array.isArray(json.contributions) ? (json.contributions as ContributionDay[]) : [];

    if (!Array.isArray(raw) || raw.length === 0) {
      console.warn(`[github-heatmap] No contribution data for ${sanitizedUsername} from upstream API`);
      return new Response(
        JSON.stringify({ error: "No contribution data found", fallback: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const contributions: ContributionDay[] = raw.map((item) => {
      const date = String(item.date);
      const count = typeof item.count === "number" ? item.count : Number(item.count ?? 0) || 0;
      const rawLevel = typeof item.level === "number" ? item.level : Number(item.level ?? 0) || 0;
      const clamped = Math.min(4, Math.max(0, rawLevel));
      const level = clamped as 0 | 1 | 2 | 3 | 4;
      return { date, count, level };
    });

    console.log(`[github-heatmap] Successfully parsed ${contributions.length} days for ${sanitizedUsername}`);

    return new Response(
      JSON.stringify({ username: sanitizedUsername, contributions }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[github-heatmap] Error:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errMessage, fallback: true }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
