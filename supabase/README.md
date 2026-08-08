# Spotify Now Playing Setup

Use this to make JARVIS read Spotify from Supabase instead of authenticating on the glasses.

## 1. Create the table

Open Supabase SQL Editor and run:

```sql
-- Paste the contents of supabase/sql/spotify_now_playing.sql
```

This creates one public-read row at `spotify_now_playing.id = 'main'`.

## 2. Create the Edge Function

Create an Edge Function named:

```text
spotify-now-playing
```

Paste the contents of:

```text
supabase/functions/spotify-now-playing/index.ts
```

## 3. Add Edge Function secrets

In Supabase Dashboard, open Edge Functions secrets and add:

```text
SPOTIFY_CLIENT_ID=your Spotify client id
SPOTIFY_CLIENT_SECRET=your Spotify client secret
SPOTIFY_REFRESH_TOKEN=your Spotify refresh token
SUPABASE_URL=https://cwpruhtfdmwxthkekkfi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your Supabase service role key
```

Never put `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY` in the public website.

## 4. Get the Spotify refresh token

In the Spotify Developer Dashboard, add this temporary redirect URI to your Spotify app:

```text
http://127.0.0.1:8089/callback
```

Open this URL in your desktop browser, replacing `CLIENT_ID`:

```text
https://accounts.spotify.com/authorize?response_type=code&client_id=CLIENT_ID&scope=user-read-currently-playing%20user-modify-playback-state&redirect_uri=http%3A%2F%2F127.0.0.1%3A8089%2Fcallback
```

Approve Spotify. Your browser will fail to load `127.0.0.1`, but the address bar will contain:

```text
http://127.0.0.1:8089/callback?code=THE_CODE
```

Copy `THE_CODE`.

Exchange it for a refresh token:

```powershell
$clientId = "YOUR_CLIENT_ID"
$clientSecret = "YOUR_CLIENT_SECRET"
$code = "THE_CODE_FROM_BROWSER"
$redirectUri = "http://127.0.0.1:8089/callback"
$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${clientId}:${clientSecret}"))

Invoke-RestMethod `
  -Method Post `
  -Uri "https://accounts.spotify.com/api/token" `
  -Headers @{ Authorization = "Basic $basic" } `
  -ContentType "application/x-www-form-urlencoded" `
  -Body @{
    grant_type = "authorization_code"
    code = $code
    redirect_uri = $redirectUri
  }
```

Copy the returned `refresh_token` into the Supabase secret `SPOTIFY_REFRESH_TOKEN`.

The `user-modify-playback-state` scope lets JARVIS use the Spotify previous, play/pause, and next controls.

## 5. Run it once

Invoke:

```text
https://cwpruhtfdmwxthkekkfi.supabase.co/functions/v1/spotify-now-playing
```

Then refresh the JARVIS site.

Playback action URLs:

```text
https://cwpruhtfdmwxthkekkfi.supabase.co/functions/v1/swift-endpoint?action=previous
https://cwpruhtfdmwxthkekkfi.supabase.co/functions/v1/swift-endpoint?action=toggle
https://cwpruhtfdmwxthkekkfi.supabase.co/functions/v1/swift-endpoint?action=next
```

## 6. Keep it fresh

Schedule the function every minute using Supabase scheduled functions or any external cron monitor.
