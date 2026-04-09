# Platform Adapter Notes

## X

### OAuth
- Auth flow: OAuth 2.0 Authorization Code with PKCE
- Default scopes in `.env.example`:
  - `tweet.read`
  - `users.read`
  - `tweet.write`
  - `media.write`
  - `offline.access`

### Publish
- Text post:
  - `POST https://api.x.com/2/tweets`
- Image post:
  1. `POST https://api.x.com/2/media/upload`
  2. `POST https://api.x.com/2/tweets` with `media.media_ids`

### Analytics
- `GET https://api.x.com/2/tweets/{id}?tweet.fields=public_metrics,non_public_metrics,organic_metrics,promoted_metrics`
- `public_metrics` is broadly available
- non-public / organic metrics require user-context auth and are only available for recent owned posts

## LinkedIn safe path

### OAuth
- Safe-path scopes:
  - `openid`
  - `profile`
  - `email`
  - `w_member_social`

### Publish
- Member text and image posts use:
  - `POST https://api.linkedin.com/v2/ugcPosts`
- Member image upload flow:
  1. `POST https://api.linkedin.com/v2/assets?action=registerUpload`
  2. upload binary to returned `uploadUrl`
  3. create the `ugcPost` with `shareMediaCategory: "IMAGE"`

### Canonical URL
- Use the returned `X-RestLi-Id` header
- Normalize to `urn:li:ugcPost:<id>` if LinkedIn only returns the numeric id
- Canonical URL shape:
  - `https://www.linkedin.com/feed/update/urn:li:ugcPost:<id>/`

## LinkedIn private local reader

### Delivery model
- Unpacked Chrome extension
- Localhost-only
- Reads visible LinkedIn pages from your logged-in browser
- Sends normalized payloads back to the Next.js app through local API routes

### Extraction order
1. DOM extraction from visible LinkedIn pages
2. Local OCR for screenshot imports and fallback parsing
3. Gemini only for messy screenshots or low-confidence image understanding

### Local routes
- `POST /api/local-reader/pair`
- `GET /api/local-reader/status`
- `POST /api/local-reader/linkedin/start`
- `POST /api/local-reader/linkedin/ingest`
- `POST /api/local-reader/linkedin/finish`

### Current scope
- profile analytics snapshots
- discovered post URLs from recent activity pages
- post-level visible metrics
- first visible comments
- raw extracted text and browser evidence

## Edward Engine v2 behavior
- X tries official publish + official metric sync
- LinkedIn tries official publish on the safe path
- LinkedIn read-side can now come from three sources:
  - browser sync via the local reader
  - manual URL + screenshot import
  - OCR/Gemini fallback on imported evidence
- all of that data feeds:
  - `metricSnapshots`
  - `accountMetricSnapshots`
  - `postFeatureSets`
  - `localSyncRuns`
  - the LinkedIn insights dashboard
