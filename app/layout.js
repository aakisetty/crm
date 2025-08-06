import './globals.css'

export const metadata = {
  title: 'Real Estate CRM - Lead Management System',
  description: 'AI-powered real estate CRM with lead management, property matching, and deal tracking',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}