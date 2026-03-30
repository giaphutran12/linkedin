# Edward Engine

Internal X + LinkedIn content portal for:
- composing one content item and generating both platform variants
- publishing through official adapters when possible
- importing native posts later with URL + screenshot evidence
- OCR parsing analytics screenshots
- storing a local memory of posts, metrics, and comment notes

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

That keeps the first version easy to evolve before we commit to a database.

## OAuth setup

The app supports official OAuth connectors for:
- X
- LinkedIn

The safe LinkedIn path only asks for:
- `openid`
- `profile`
- `email`
- `w_member_social`

Read-side LinkedIn scopes are intentionally not assumed in v1.

## Platform notes

See [docs/platform-adapters.md](./docs/platform-adapters.md) for the official publish and upload flows the adapters are based on.
