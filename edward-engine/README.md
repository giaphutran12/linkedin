# Edward Engine

Internal X + LinkedIn content portal for:
- composing one content item and generating both platform variants
- publishing through official adapters when possible
- importing native posts later with URL + screenshot evidence
- running a private local-only LinkedIn reader through a Chrome extension
- storing a local memory of posts, metrics, comment notes, and post features
- learning what hooks, timings, screenshots, and CTAs are actually working

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create your local env file

```bash
cp .env.example .env.local
```

3. Run the app

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Local data model

The app is intentionally local-first:
- JSON store: `data/store.json`
- uploaded evidence: `public/uploads/`

That keeps the first version easy to evolve before committing to a database.

## OAuth setup

The app supports official OAuth connectors for:
- X
- LinkedIn

The safe LinkedIn path only asks for:
- `openid`
- `profile`
- `email`
- `w_member_social`

Read-side LinkedIn scopes are intentionally not assumed in the safe path.

## Gemini vision fallback

If `GEMINI_API_KEY` is present, Edward Engine can use Gemini for:
- messy screenshot metric extraction
- image-family classification
- fallback parsing when OCR confidence is weak

Gemini is only used when it adds value.
DOM extraction stays first for browser sync, and Tesseract stays the cheap local fallback.

## Local reader extension

The LinkedIn private reader is a localhost-only Chrome extension companion.

### Load it unpacked

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `extension/` folder inside `edward-engine`

### Pair it

1. Start Edward Engine locally
2. Open the app in Chrome
3. Click `Pair extension` in the `LinkedIn Local Reader` panel
4. Add your profile URL hint in the dashboard if you want post discovery to be smoother

### Sync flow

1. Click `Sync LinkedIn now`
2. The extension reads visible LinkedIn pages from your logged-in browser session
3. It posts normalized data back to the local app
4. Edward Engine updates:
   - post metrics
   - profile analytics snapshots
   - visible comments
   - post feature sets
   - insights and recommendations

The extension is local-only and is intentionally not part of the Vercel-safe path.

## Platform notes

See [docs/platform-adapters.md](./docs/platform-adapters.md) for the publish, analytics, and local-reader behavior by platform.
