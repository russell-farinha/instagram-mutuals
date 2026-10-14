# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

**Mutuals** — a web app that compares an Instagram account's *followers* against its
*following* and reports the difference: who you follow that doesn't follow back, who
follows you that you don't follow back, and who is mutual.

The defining constraint: **it never asks for an Instagram login.** No OAuth, no password,
no session cookie, no "connect your account."

## Status

Planning complete. No application code exists yet. The next session scaffolds the app.
Read `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before writing code.

## Hard constraints — do not violate

These are product-defining, not preferences. If a task appears to require breaking one,
stop and raise it with the user instead of working around it.

1. **No backend. Ever.** This is a static SPA deployed to GitHub Pages. The absence of a
   server *is* the privacy guarantee the product advertises. Do not add API routes, a
   Node server, an edge function, or a proxy.
2. **No Instagram credentials.** Never prompt for an Instagram username+password, never
   implement a login flow, never store or transmit an Instagram session cookie, and never
   drive a headless browser against a logged-in Instagram session.
3. **No secrets in the repo.** There is no project-owned API key. Lookup uses a key the
   *user* pastes in, held in their own browser. Nothing goes in `.env` and gets committed.
4. **User data stays on the device.** The export file is parsed in-browser and never
   uploaded. No analytics that carry usernames, no error reporting that includes list
   contents, no telemetry on who was looked up.
5. **No circumventing Instagram's own defenses.** Don't add rotating proxies, user-agent
   rotation to evade blocks, or rate-limit evasion. If the public path is closed, it's
   closed.

## Verified technical findings — don't rediscover these

Checked 2026-10-14. Instagram has closed *all* anonymous access. Every one of these
returns `HTTP 401 {"require_login": true}`:

| Endpoint | Result |
|---|---|
| `GET /api/v1/users/web_profile_info/?username=X` (+ `X-IG-App-ID`) | 401 |
| `GET /api/v1/friendships/{id}/followers/` | 401 |
| `GET /api/v1/friendships/{id}/following/` | 401 |
| `GET /graphql/query/?query_hash=...` (legacy) | 401 |
| `GET /{username}/?__a=1&__d=dis` (legacy) | dead, empty 201 |

**Consequence:** there is no way to fetch follower/following lists — or even follower
*counts* — directly from Instagram without authentication. Do not spend time trying. Any
username-lookup feature necessarily goes through a third-party provider.

Also verified: RapidAPI-hosted providers return
`access-control-allow-origin: <reflected origin>` and permit the `x-rapidapi-key` request
header on preflight. Browser-direct calls therefore work, which is what makes the
bring-your-own-key model viable with no proxy.

## Architecture in one page

Two data sources behind one interface. Everything downstream is source-agnostic.

```ts
interface FollowDataSource {
  getFollowers(): Promise<Account[]>
  getFollowing(): Promise<Account[]>
}
```

- **`ExportFileSource`** — user uploads their Instagram "Download Your Information"
  export. Exact and complete, works even for private accounts (it's their own data),
  free, and fully ToS-clean. This is the *accurate* mode.
- **`ApiLookupSource`** — user types a username; the browser calls a third-party provider
  directly using a key the user supplied. Convenient, public accounts only, often
  truncated for large accounts, and may break without warning. This is the *convenient*
  mode.

The comparison engine (`diff(followers, following)`) is pure and must stay free of any
knowledge of where the data came from. Keep it that way — it's the most testable part of
the app and the easiest thing to accidentally couple.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- `jszip` for reading the export archive
- Vitest for unit tests
- GitHub Pages for deploy

## Commands

Not yet scaffolded. Once it is, the expected set:

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint
```

## Conventions

- TypeScript strict mode. Avoid `any`; prefer a discriminated union over a loose object.
- The pure comparison logic gets unit tests. UI components generally don't, unless they
  contain real logic.
- Keep parsing defensive: Instagram changes its export shape periodically, so validate
  structure and fail with a message a non-technical person can act on, never a raw stack
  trace or a silent empty result.
- Treat an uploaded file as untrusted input. Usernames go into the DOM as text, never as
  HTML.

## Tone of the product

The audience is non-technical. "Request your data from Instagram, then drag the zip here"
has to feel approachable, and the results screen should feel friendly rather than
accusatory — this is a tool people use to tidy up, not to build a case against anyone.
Avoid shaming language in the UI ("doesn't follow you back" is fine; "ignoring you" is not).
