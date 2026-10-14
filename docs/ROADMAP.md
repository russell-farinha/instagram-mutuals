# Roadmap

Ordered so that something genuinely useful exists as early as possible. The export path
is built first because it's the one that definitely works and can't break out from under
us.

## Phase 0 — Scaffold

- [ ] Vite + React + TypeScript, strict mode
- [ ] Tailwind
- [ ] Vitest
- [ ] ESLint + Prettier
- [ ] GitHub Actions: typecheck, lint, test on PR
- [ ] GitHub Actions: build + deploy to Pages on `main`

## Phase 1 — The comparison engine

Pure logic, no UI, fully tested. Everything else depends on this being right.

- [ ] `Account` and `FollowDataSource` types
- [ ] `diff()` → mutuals / not-following-back / fans
- [ ] Unit tests: empty lists, one-sided, full overlap, case differences in usernames,
      duplicates, very large lists (100k+)

## Phase 2 — Export upload (accurate mode)

- [ ] `ExportFileSource`: read `.zip` via `jszip`
- [ ] Handle paginated `followers_N.json`
- [ ] Handle the two different file shapes (array vs. `relationships_following` wrapper)
- [ ] Accept loose `.json` files and unzipped folders, not just the archive
- [ ] Schema validation with human-readable failures
- [ ] Drag-and-drop with a clear non-technical empty state
- [ ] Guided walkthrough of requesting the export from Instagram

## Phase 3 — Results UI

This is where the product either feels friendly or feels like a spreadsheet.

- [ ] Three tabbed lists with counts
- [ ] Search / filter within a list
- [ ] Sort by username or by follow date (export mode has timestamps)
- [ ] Each row links out to the profile
- [ ] Summary header — totals and a mutual-rate figure
- [ ] Export results to CSV
- [ ] Responsive down to ~400px
- [ ] Light and dark themes
- [ ] Keyboard navigable, screen-reader sane

## Phase 4 — Username lookup (convenient mode)

Deliberately last: it depends on a third party and may need rework when that party
changes.

- [ ] `ApiLookupSource` against the `FollowDataSource` interface
- [ ] Settings screen for the user's own API key, stored in `localStorage`
- [ ] Up-front explanation of the tradeoffs before first use
- [ ] Clear handling of: private account, account not found, quota exhausted,
      truncated list, provider down
- [ ] Say so visibly when results are partial — never present a truncated list as complete

## Phase 5 — Polish

- [ ] Extras from the export: pending requests, recently unfollowed
- [ ] Compare two exports over time to see what changed
- [ ] Onboarding for first-time visitors
- [ ] Favicon, social preview, a real landing section

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
