'use client'

import { useState } from 'react'
import { Mail, Lock, LogIn, Eye, EyeOff, ArrowRight, HeartPulse, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export function LoginView() {
  const { navigate, setUser } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password')
      return
    }
    setLoading(true)
    try {
      const { user } = await api.login(email.trim(), password)
      setUser(user)
      toast.success(`Welcome back, ${user.firstName || user.email}!`)
      navigate(user.role === 'admin' ? 'admin' : 'home')
    } catch (err: any) {
      toast.error(err?.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const fillAdminDemo = () => {
    setEmail('admin@jkrinternational.com')
    setPassword('admin123')
  }

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center bg-gradient-to-br from-brand-teal/5 via-background to-brand-cyan/5 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-teal text-white shadow-lg">
            <HeartPulse className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-teal">
            JKR International
          </p>
          <p className="text-xs text-muted-foreground">Medical Equipment Solutions</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-brand-ink">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your account to manage enquiries and orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-pwd" className="text-sm font-medium">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => toast.info('Password recovery coming soon. Please contact support.')}
                    className="text-xs font-medium text-brand-teal hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-pwd"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-brand-ink"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-teal text-white hover:bg-brand-teal-dark"
                size="lg"
              >
                {loading ? (
                  'Signing in...'
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Admin demo hint */}
            <div className="mt-4 rounded-lg border border-dashed border-brand-gold/50 bg-brand-gold/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-brand-gold" />
                Admin demo:{' '}
                <button
                  type="button"
                  onClick={fillAdminDemo}
                  className="font-semibold text-brand-ink underline-offset-2 hover:underline"
                >
                  admin@jkrinternational.com / admin123
                </button>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Click the credentials to auto-fill
              </p>
            </div>

            <Separator className="my-5" />

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => navigate('register')}
                className="font-semibold text-brand-teal hover:underline"
              >
                Register here
                <ArrowRight className="ml-1 inline h-3 w-3" />
              </button>
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in you agree to our{' '}
          <button onClick={() => navigate('terms')} className="underline hover:text-brand-teal">
            Terms
          </button>{' '}
          &amp;{' '}
          <button onClick={() => navigate('privacy')} className="underline hover:text-brand-teal">
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  )
}
