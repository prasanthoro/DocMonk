import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import Header from '../components/Header'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'DocMonk — AI-Powered Legal Document Analysis',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased bg-white text-slate-900 min-h-screen">
        <Header />
        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}
