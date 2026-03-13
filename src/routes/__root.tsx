import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

function NotFound(){
  return(
    <h1>Page Not Found !</h1>
  )
}
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
  notFoundComponent:NotFound,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased bg-white text-slate-900 min-h-screen">
        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}
