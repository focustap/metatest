import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SpotifyImage = {
  url: string;
};

type SpotifyArtist = {
  name: string;
};

type SpotifyItem = {
  type: "track" | "episode";
  name: string;
  duration_ms: number;
  external_urls?: {
    spotify?: string;
  };
  artists?: SpotifyArtist[];
  album?: {
    name?: string;
    images?: SpotifyImage[];
  };
  show?: {
    name?: string;
    publisher?: string;
  };
  images?: SpotifyImage[];
};

type SpotifyPlayback = {
  is_playing: boolean;
  progress_ms: number;
  item?: SpotifyItem;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = requiredEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = requiredEnv("SPOTIFY_CLIENT_SECRET");
    const refreshToken = requiredEnv("SPOTIFY_REFRESH_TOKEN");

    const accessToken = await refreshSpotifyAccessToken(
      clientId,
      clientSecret,
      refreshToken,
    );

    const playback = await fetchSpotifyPlayback(accessToken);
    const row = spotifyPlaybackToRow(playback);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase
      .from("spotify_now_playing")
      .upsert(row, { onConflict: "id" });

    if (error) {
      throw error;
    }

    return json({ ok: true, row });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: String(error) }, 500);
  }
});

function requiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

async function refreshSpotifyAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Spotify token refresh failed: ${response.status}`);
  }

  const token = await response.json();
  return token.access_token as string;
}

async function fetchSpotifyPlayback(accessToken: string) {
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify playback failed: ${response.status}`);
  }

  return await response.json() as SpotifyPlayback;
}

function spotifyPlaybackToRow(playback: SpotifyPlayback | null) {
  const now = new Date().toISOString();

  if (!playback?.item) {
    return {
      id: "main",
      title: "Spotify idle",
      artist: "No active playback",
      album: "",
      cover_url: null,
      external_url: null,
      progress_ms: 0,
      duration_ms: 1,
      is_playing: false,
      source: "spotify",
      fetched_at: now,
      updated_at: now,
    };
  }

  const item = playback.item;
  const isEpisode = item.type === "episode";
  const image = isEpisode ? item.images?.[0]?.url : item.album?.images?.[0]?.url;
  const artist = isEpisode
    ? item.show?.publisher || "Podcast"
    : item.artists?.map((entry) => entry.name).join(", ") || "";
  const album = isEpisode ? item.show?.name || "" : item.album?.name || "";

  return {
    id: "main",
    title: item.name,
    artist,
    album,
    cover_url: image || null,
    external_url: item.external_urls?.spotify || null,
    progress_ms: playback.progress_ms || 0,
    duration_ms: item.duration_ms || 1,
    is_playing: playback.is_playing,
    source: "spotify",
    fetched_at: now,
    updated_at: now,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
