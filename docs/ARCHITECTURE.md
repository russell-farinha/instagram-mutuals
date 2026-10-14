# Architecture

## The constraint that shapes everything

Instagram has closed all anonymous access to follower and following data. Verified
2026-10-14 — every one of these returns `HTTP 401 {"require_login": true}`:

| Endpoint | Result |
|---|---|
| `/api/v1/users/web_profile_info/?username=X` (with `X-IG-App-ID`) | 401 |
| `/api/v1/friendships/{id}/followers/` | 401 |
| `/api/v1/friendships/{id}/following/` | 401 |
| `/graphql/query/?query_hash=...` (legacy) | 401 |
| `/{username}/?__a=1&__d=dis` (legacy) | dead |

Not only are the *lists* gated — so are follower **counts**. There is no longer a
"scrape the public profile" path of any kind.

This rules out the obvious design (type a username, fetch their lists from Instagram).
What's left are two legitimate sources, and the app supports both.

## Two sources, one interface

```
                  ┌────────────────────────┐
  export .zip ───▶│   ExportFileSource     │──┐
                  └────────────────────────┘  │   ┌──────────────┐   ┌─────────┐
                                              ├──▶│ FollowData   │──▶│  diff() │──▶ UI
                  ┌────────────────────────┐  │   │   Source     │   │  (pure) │
  @username   ───▶│   ApiLookupSource      │──┘   └──────────────┘   └─────────┘
                  └────────────────────────┘
```

```ts
type Account = {
  username: string
  href: string
  timestamp?: number      // when the follow happened, export only
}

interface FollowDataSource {
  getFollowers(): Promise<Account[]>
  getFollowing(): Promise<Account[]>
}
```

`diff()` is pure and source-agnostic:

```ts
function diff(followers: Account[], following: Account[]): {
  mutuals: Account[]
  notFollowingBack: Account[]   // in following, not in followers
  fans: Account[]               // in followers, not in following
}
```

Keeping `diff()` free of any source knowledge is the single most important structural
rule here. It's the part worth testing properly, and the part most likely to get
accidentally coupled to a file format.

### ExportFileSource — the accurate path

Reads Instagram's "Download Your Information" archive (JSON format) client-side via
`jszip`. Relevant paths inside the archive:

```
connections/followers_and_following/followers_1.json
connections/followers_and_following/following.json
connections/followers_and_following/pending_follow_requests.json
connections/followers_and_following/recently_unfollowed_profiles.json
```

Notes that matter for implementation:
- **Followers are paginated across files** — `followers_1.json`, `followers_2.json`, …
  for large accounts. Glob the directory; don't hardcode `_1`.
- **The two files have different shapes.** Followers is a top-level array; following is
  an object wrapping `relationships_following`. Handle both.
- **The export shape changes periodically.** Validate and fail with an actionable
  message, never a stack trace or a silent empty result.
- The archive can also be a plain folder or individual `.json` files — accept those too,
  since people unzip things.

### ApiLookupSource — the convenient path

A username lookup has to go through a third-party provider that maintains its own
authenticated session pool. Design decision: **the user brings their own API key.**

This was initially assumed to require a backend, since an API key can't ship inside a
static bundle. Probing a representative RapidAPI host showed otherwise:

```
access-control-allow-origin: https://russell-farinha.github.io   (origin reflected)
access-control-allow-headers: x-rapidapi-key, x-rapidapi-host, ...
access-control-allow-credentials: true
```

Preflight permits the key header and reflects the requesting origin, so the browser can
call the provider **directly**. No proxy, no server, no project-owned key — which is what
lets the zero-backend guarantee survive alongside the lookup feature.

The key lives in `localStorage` and is sent only to the provider. Treat `localStorage` as
unreliable (private windows, blocked site data) and degrade gracefully.

Keep the provider behind an adapter so swapping vendors is a single-file change; assume
the first choice will eventually break.

## Why no backend

The "no server" property isn't incidental — it's the product's central claim. A static
site physically cannot retain user data, which is a far stronger guarantee than a privacy
policy promising it doesn't. It also makes the public repo meaningful: anyone can audit
that there's no exfiltration path.

Adding a server later would cost that claim. Don't, without an explicit decision to
trade it away.

## Threat model

What this app deliberately does **not** do, and why:

| Not doing | Why |
|---|---|
| Instagram login / OAuth / session cookies | The entire premise. Also what gets users banned. |
| Headless browser against a logged-in session | Same, plus fragile and against ToS. |
| Project-owned API key | Would require a server to hold it, and someone to pay per lookup. |
| Proxy rotation / UA rotation / rate-limit evasion | Circumventing platform defenses. Out of bounds. |
| Analytics carrying usernames or list contents | Contradicts the privacy claim. |

Uploaded files are untrusted input. Usernames render as text, never HTML.

## Deployment

Static build → GitHub Pages via GitHub Actions on push to `main`. No environment
secrets required, because there are none.
