# Roadmap

Ordered so that something genuinely useful exists as early as possible. The export path
is built first because it's the one that definitely works and can't break out from under
us.

## Phase 0 — Scaffold

- [x] Vite + React + TypeScript, strict mode
- [x] Tailwind
- [x] Vitest
- [x] ESLint + Prettier
- [x] GitHub Actions: typecheck, lint, test on PR
- [x] GitHub Actions: build + deploy to Pages on `main`

## Phase 1 — The comparison engine

Pure logic, no UI, fully tested. Everything else depends on this being right.

- [x] `Account` and `FollowDataSource` types
- [x] `diff()` → mutuals / not-following-back / fans
- [x] Unit tests: empty lists, one-sided, full overlap, case differences in usernames,
      duplicates, very large lists (100k+)

## Phase 2 — Export upload (accurate mode)

- [x] `ExportFileSource`: read `.zip` via `jszip`
- [x] Handle paginated `followers_N.json`
- [x] Handle the two different file shapes (array vs. `relationships_following` wrapper)
- [x] Accept loose `.json` files and unzipped folders, not just the archive
- [x] Schema validation with human-readable failures
- [x] Drag-and-drop with a clear non-technical empty state
- [x] Guided walkthrough of requesting the export from Instagram

## Phase 3 — Results UI

This is where the product either feels friendly or feels like a spreadsheet.

- [x] Three tabbed lists with counts
- [x] Search / filter within a list
- [x] Sort by username or by follow date (export mode has timestamps)
- [x] Each row links out to the profile
- [x] Summary header — totals and a mutual-rate figure
- [x] Export results to CSV
- [x] Responsive down to ~400px
- [x] Light and dark themes
- [x] Keyboard navigable, screen-reader sane

## Phase 4 — Username lookup (convenient mode)

Deliberately last: it depends on a third party and may need rework when that party
changes.

- [x] `ApiLookupSource` against the `FollowDataSource` interface
- [x] Settings screen for the user's own API key, stored in `localStorage`
- [x] Up-front explanation of the tradeoffs before first use
- [x] Clear handling of: private account, account not found, quota exhausted,
      truncated list, provider down
- [x] Say so visibly when results are partial — never present a truncated list as complete

## Phase 5 — Polish

- [x] Extras from the export: pending requests, recently unfollowed
- [x] Compare two exports over time to see what changed
- [x] Onboarding for first-time visitors
- [x] Favicon, social preview, a real landing section

## Explicitly out of scope

- Any Instagram login, OAuth, or session handling
- A backend of any kind
- Bulk following/unfollowing, or any write action against Instagram
- Analysing accounts at scale, or anything resembling surveillance of third parties
- Evading Instagram's rate limiting or bot detection

## Open questions for the build session

1. **Which lookup provider first?** Needs a comparison on price, list caps, and how
   recently it was actually working. Assume it will need replacing eventually.
2. **How large is "too large"?** A 500k-follower export will need streaming or chunked
   parsing to avoid freezing the tab. Worth measuring before optimising.
3. **Is lookup mode worth shipping at all?** If the provider landscape looks bad on
   inspection, export-only is a perfectly good product and a more honest one.
