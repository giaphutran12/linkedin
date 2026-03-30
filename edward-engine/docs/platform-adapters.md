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

## LinkedIn

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

## Edward Engine v1 behavior
- X tries official publish + official metric sync
- LinkedIn tries official publish
- LinkedIn read-side metrics stay mixed-mode in v1:
  - URL import
  - screenshot upload
  - OCR parse
- Private local-only LinkedIn browser capture is explicitly out of scope for v1
