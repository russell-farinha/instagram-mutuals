# Mutuals

Find out who follows you back on Instagram — without ever handing over your password.

Mutuals compares the list of people you **follow** against the list of people who
**follow you**, then shows you the three groups that fall out of that:

- **Mutuals** — you follow each other
- **Not following back** — you follow them, they don't follow you
- **Your fans** — they follow you, you don't follow them back

> **Status: export mode is usable.** Upload an Instagram JSON export to compare your
> follower and following lists privately. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Why another one of these?

Most follower-checker tools ask you to log in with your Instagram account. That hands a
third party a session they can use as you — which is why Instagram bans accounts for it,
and why those tools periodically show up in credential-leak writeups.

Mutuals never asks for an Instagram login. There is also **no server** in this project:
it's a static site, so your data has nowhere to go even in principle. You can verify that
claim yourself — that's part of why the repo is public.

## Two ways to use it

### Accurate mode — your data export (recommended)

Instagram will give you your own follower and following lists on request. Mutuals reads
that file **in your browser** and never uploads it.

1. In Instagram: **Accounts Center → Your information and permissions → Download your information**
2. Request your information, choosing **JSON** as the format
3. Instagram emails you a download link (minutes to a few hours)
4. Drag the `.zip` into Mutuals

Why this mode is better:
- **Exact** — the complete lists, not a truncated sample
- **Works on private accounts**, because it's your own data
- **Free**, and entirely within Instagram's terms
- Includes extras the public view can't show, like pending follow requests

### Convenient mode — look up a username

Type a public username and get results immediately, with no waiting on an export.

The tradeoffs are real and worth knowing up front:

- Instagram blocks all anonymous access to follow lists, so this mode calls a
  **third-party data provider**. You supply your own API key; it's stored in your browser
  and never sent anywhere except to that provider.
- **Public accounts only.** A private account returns nothing.
- **Large accounts get truncated** — providers cap how much of a list they'll return.
- **It can break at any time.** These providers fight an ongoing battle with Instagram's
  defenses, and they lose sometimes.

If you want the real answer, use the export. If you want a quick look, use this.

## Privacy

- No account connection, no password, no OAuth, no session cookie.
- No backend. Nothing to log, because there's no server to log it.
- Your export is parsed locally and never leaves your device.
- Your provider API key, if you use one, stays in your browser's local storage.

## Tech

Vite · React · TypeScript · Tailwind · Vitest — deployed as a static site on GitHub Pages.

## Development

```bash
git clone https://github.com/russell-farinha/instagram-mutuals.git
cd instagram-mutuals
npm install
npm run dev
```

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it's put together, and the research behind it
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what gets built, in what order
- [`CLAUDE.md`](CLAUDE.md) — working notes and constraints for AI-assisted development

## A note on scope

This is built around analyzing **your own** account. That's a deliberate product
decision, not just a technical one: the accurate mode only works on data Instagram gives
*you* about *your* account, and that's the use case the tool is designed to serve well.

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with, endorsed by, or connected to Instagram or Meta.
