import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-lg shadow-sm">
      <nav className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        {/* Logo */}
        <h1 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 no-underline font-bold transition hover:bg-indigo-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            DocMonk
          </Link>
        </h1>

        {/* Nav links */}
        <div className="flex items-center gap-1 ml-4">
          <Link
            to="/"
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 no-underline transition hover:bg-slate-100 hover:text-slate-900"
            activeProps={{ className: 'px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-900 no-underline' }}
          >
            Home
          </Link>
          <Link
            to="/analyze"
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 no-underline transition hover:bg-slate-100 hover:text-slate-900"
            activeProps={{ className: 'px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-900 no-underline' }}
          >
            Analyze
          </Link>
          <Link
            to="/qa"
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 no-underline transition hover:bg-slate-100 hover:text-slate-900"
            activeProps={{ className: 'px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-900 no-underline' }}
          >
            Document Q&amp;A
          </Link>
        </div>

        {/* CTA button */}

      </nav>
    </header>
  )
}
