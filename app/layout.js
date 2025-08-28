import './globals.css'
import Image from 'next/image'
import { Toaster } from '@/components/ui/toaster'
import { NotificationBell } from '@/components/NotificationCenter'

export const metadata = {
  title: 'Real Estate CRM - Lead Management System',
  description: 'AI-powered real estate CRM with lead management, property matching, and deal tracking',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Top App Bar */}
        <header className="sticky top-0 z-40 w-full border-b bg-secondary/70 backdrop-blur supports-[backdrop-filter]:bg-secondary/60">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <Image
                src="/snaphomz-logo.svg"
                alt="Snaphomz"
                width={36}
                height={36}
                priority
              />
              <span className="text-lg font-semibold tracking-tight">Snaphomz</span>
            </a>
            <div className="hidden md:flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="h-9 w-64 rounded-md border bg-background px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
              <NotificationBell />
              <div className="h-8 w-8 rounded-full bg-foreground/10" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        {children}
        <Toaster />
      </body>
    </html>
  )
}