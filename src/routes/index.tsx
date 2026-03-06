import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-20 px-4">
        <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-100 opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-purple-100 opacity-40 blur-3xl" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            AI-Powered Legal Intelligence
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            DocMonk — AI-Powered<br />
            <span className="text-indigo-600">Legal Document Analysis</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Analyze legal contracts, identify clause violations, ask questions about your documents,
            and get instant AI-powered insights. Built for legal teams, businesses, and individuals.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white no-underline transition hover:bg-indigo-700 shadow-lg shadow-indigo-200"
            >
              Start Analyzing
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link
              to="/qa"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 no-underline transition hover:bg-slate-50 shadow-sm"
            >
              Try Document Q&A
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need for contract intelligence</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">From clause analysis to interactive Q&A — DocMonk handles the heavy lifting.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Clause Analysis */}
            <Link
              to="/analyze"
              className="group relative rounded-2xl border border-slate-100 bg-white p-8 shadow-sm no-underline transition hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Clause Analysis</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Upload your contracts and analyze specific clauses. Get instant feedback on matches, violations, and missing terms — powered by AI.
              </p>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                Start analyzing
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </Link>

            {/* Card 2: Document Q&A */}
            <Link
              to="/qa"
              className="group relative rounded-2xl border border-slate-100 bg-white p-8 shadow-sm no-underline transition hover:shadow-md hover:border-purple-100 hover:-translate-y-0.5"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition group-hover:bg-purple-600 group-hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Document Q&A</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Upload documents and ask any question in plain English. Get instant, accurate answers with source references and page hints.
              </p>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-600">
                Start chatting
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </Link>

            {/* Card 3: Coming Soon */}
            <div className="group relative rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100 p-8 shadow-sm opacity-70 cursor-not-allowed">
              <div className="absolute top-4 right-4">
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                  Coming Soon
                </span>
              </div>
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Contract Generation</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Generate legally sound contracts from templates. Customize clauses, add parties, and export ready-to-sign documents.
              </p>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-400">
                Available soon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">How it works</h2>
          <p className="text-slate-500 text-lg mb-14">Three simple steps to get document intelligence</p>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload your document",
                desc: "Upload PDF, DOCX, or paste your contract text directly into the editor.",
                color: "bg-indigo-600",
              },
              {
                step: "02",
                title: "Define your clauses",
                desc: "Add the clauses you want to check — set categories, titles, and expected values.",
                color: "bg-purple-600",
              },
              {
                step: "03",
                title: "Get AI insights",
                desc: "Receive detailed analysis: matches, violations, missing terms, and more.",
                color: "bg-emerald-600",
              },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="rounded-2xl bg-white border border-slate-100 p-8 shadow-sm text-left">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color} text-white font-bold text-sm mb-4`}>
                  {step}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 px-4 text-center">
        <p className="text-slate-400 text-sm">
          DocMonk — AI-Powered Legal Document Analysis. Built with TanStack Start + EditorJS.
        </p>
      </footer>
    </div>
  )
}
