import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface">
      <header className="page-shell flex items-center justify-between py-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-brand">Pollpoint</Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary">Log in</Link>
          <Link href="/register" className="btn-primary">Create account</Link>
        </div>
      </header>

      <section className="page-shell grid min-h-[75vh] items-center gap-12 py-12 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="mb-5 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-brand">
            A clearer way to collect opinions
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-brand sm:text-5xl">
            Create thoughtful polls. Make better decisions.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Create polls, organize questions, and collect votes through one simple workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">Get started</Link>
            <Link href="/login" className="btn-secondary">I already have an account</Link>
          </div>
        </div>

        <div className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-brand">Example poll</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Preview</span>
          </div>
          <h2 className="mt-5 text-xl font-bold">Which feature should we build next?</h2>
          <div className="mt-5 space-y-3">
            {["Team collaboration", "Advanced reports", "Mobile experience"].map((option, index) => (
              <div key={option} className="flex items-center gap-3 rounded-xl border border-border p-4">
                <span className="flex size-6 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-500">{String.fromCharCode(65 + index)}</span>
                <span className="font-medium text-slate-700">{option}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-500">Illustrative preview — not live poll data.</p>
        </div>
      </section>

      <footer className="border-t border-border py-5 text-center text-sm text-slate-500">
        Pollpoint · Built with Next.js and Django REST Framework
      </footer>
    </main>
  );
}
