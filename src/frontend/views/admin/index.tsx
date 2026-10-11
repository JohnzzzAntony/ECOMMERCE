'use client'
// Admin panel entry: verifies the server session, then renders the sidebar + active section.
// Each section lives in its own file in this folder.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Home, Loader2, LogOut, Menu } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/frontend/components/ui/sheet'
import { api } from '@/frontend/lib/api'
import { useStore } from '@/frontend/store/use-store'
import type { User } from '@/shared/types'
import { errorMessage } from './admin-api'
import { BlogSection } from './blog'
import { ClientsSection, MediaSection, TestimonialsSection } from './content'
import { DashboardSection } from './dashboard'
import { NavigationSection } from './navigation'
import { NewsletterSection } from './newsletter'
import { OrdersEnquiriesSection } from './orders'
import { PagesSection } from './pages'
import { ProductsSection } from './products'
import { SECTIONS, type SectionKey } from './sections'
import { SettingsSection } from './settings'
import { ThemesSection } from './themes'
import { initials } from './shared'
import { UsersSection } from './users'

function goToStore() {
  if (window.location.pathname.startsWith('/admin')) window.location.href = '/'
  else useStore.getState().navigate('home')
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  useStore.getState().setUser(null)
  toast.success('Signed out')
}

export function AdminView() {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const [checking, setChecking] = useState(true)

  // The cached user in localStorage is only a hint; the httpOnly session cookie is the truth.
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ user: sessionUser }: { user: User | null }) => setUser(sessionUser))
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [setUser])

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-brand-bg"><Loader2 className="size-8 animate-spin text-brand-teal" /></div>
  }
  return user?.role === 'admin' ? <AdminLayout user={user} /> : <LoginGate />
}

function LoginGate() {
  const setUser = useStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { user } = await api.login(email, password)
      if (user.role !== 'admin') {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        toast.error('This account does not have administrator access.')
        return
      }
      setUser(user)
      toast.success(`Welcome back${user.firstName ? `, ${user.firstName}` : ''}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-ink via-brand-teal-dark to-brand-ink p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-gold text-2xl font-black text-white shadow-lg">NE</div>
          <h1 className="text-2xl font-bold text-white">NexEcoms</h1>
          <p className="mt-1 text-sm text-white/60">Medical Equipment · UAE</p>
        </div>
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-brand-ink">Admin Login</CardTitle>
            <CardDescription>Sign in with your administrator account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
              </div>
              <Button type="submit" disabled={loading} size="lg" className="w-full bg-brand-teal hover:bg-brand-teal-dark">{loading ? 'Signing in…' : 'Sign In'}</Button>
            </form>
          </CardContent>
        </Card>
        <div className="mt-6 text-center">
          <button onClick={goToStore} className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
            <ChevronLeft className="size-4" /> Back to store
          </button>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ section, onSelect }: { section: SectionKey; onSelect: (s: SectionKey) => void }) {
  return (
    <div className="flex h-full flex-col bg-brand-ink text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-gold font-black text-white shadow-md">NE</div>
        <div>
          <div className="font-bold leading-tight">NexEcoms</div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Admin Panel</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon, group }, i) => {
            const active = section === key
            const heading = i === 0 ? 'Management' : group !== SECTIONS[i - 1].group ? group ?? 'Configuration' : null
            return (
              <li key={key}>
                {heading && <div className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40 ${i ? 'mt-4' : ''}`}>{heading}</div>}
                <button
                  onClick={() => onSelect(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-brand-teal text-white shadow-md' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon className={`size-4 shrink-0 ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                  <span className="flex-1 text-left">{label}</span>
                  {active && <ChevronRight className="size-4" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <button onClick={goToStore} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4" /><span className="flex-1 text-left">View Site</span>
        </button>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 transition-all hover:bg-red-500/10 hover:text-red-200">
          <LogOut className="size-4" /><span className="flex-1 text-left">Logout</span>
        </button>
      </div>
    </div>
  )
}

function AdminLayout({ user }: { user: User }) {
  const [section, setSection] = useState<SectionKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const meta = SECTIONS.find((s) => s.key === section)!
  const adminName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  const select = (s: SectionKey) => {
    setSection(s)
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <DashboardSection onNavigate={select} />
      case 'products': return <ProductsSection />
      case 'orders': return <OrdersEnquiriesSection />
      case 'users': return <UsersSection />
      case 'blog': return <BlogSection />
      case 'media': return <MediaSection />
      case 'testimonials': return <TestimonialsSection />
      case 'clients': return <ClientsSection />
      case 'newsletter': return <NewsletterSection />
      case 'themes': return <ThemesSection />
      case 'pages': return <PagesSection />
      case 'navigation': return <NavigationSection />
      case 'settings': return <SettingsSection />
    }
  }

  return (
    <div className="flex min-h-screen bg-brand-bg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block"><Sidebar section={section} onSelect={select} /></aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
          <Sidebar section={section} onSelect={select} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="size-5" /></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-brand-ink lg:text-lg">{meta.label}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
          </div>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={goToStore}><Home className="size-4" /> View Site</Button>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 py-1 pl-1 pr-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">{initials(adminName)}</div>
            <div className="hidden text-sm sm:block">
              <div className="font-medium leading-tight text-brand-ink">{adminName}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">Administrator</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">{renderSection()}</div>
        </main>
      </div>
    </div>
  )
}
