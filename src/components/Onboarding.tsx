export function Onboarding() {
  return (
    <section
      className="mt-6 grid gap-4 text-sm sm:grid-cols-2"
      aria-label="How Mutuals works"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          A simple view of your connections
        </h2>
        <p className="mt-2 leading-6">
          <strong>Mutuals</strong> — you follow each other.{' '}
          <strong>Not following back</strong> — you follow them, they don't
          follow you. <strong>Your fans</strong> — they follow you, you don't
          follow them back.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Private by design
        </h2>
        <p className="mt-2 leading-6">
          No Instagram login. No server. Your file never leaves your device.{' '}
          <a
            className="font-semibold text-indigo-700 underline underline-offset-4 dark:text-indigo-300"
            href="https://github.com/russell-farinha/instagram-mutuals"
            target="_blank"
            rel="noopener noreferrer"
          >
            Check for yourself on GitHub.
          </a>
        </p>
      </div>
    </section>
  )
}
