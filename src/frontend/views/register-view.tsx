'use client'

import { useState } from 'react'
import {
  Mail, Lock, User, Phone, UserPlus, Eye, EyeOff, ArrowLeft, HeartPulse, CheckCircle2,
} from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/frontend/components/ui/card'
import { Separator } from '@/frontend/components/ui/separator'
import { toast } from 'sonner'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RegisterView() {
  const { navigate, setUser } = useStore()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const errors: Record<string, string> = {}
  if (!form.firstName.trim()) errors.firstName = 'First name is required'
  if (!form.email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email'
  if (!form.password) errors.password = 'Password is required'
  else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters'
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match'

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value })
  }
  const markTouched = (k: string) => () => setTouched({ ...touched, [k]: true })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({
      firstName: true,
      email: true,
      password: true,
      confirmPassword: true,
    })
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0])
      return
    }
    setLoading(true)
    try {
      const { user } = await api.register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
      })
      setUser(user)
      toast.success(`Account created! Welcome, ${user.firstName || user.email}.`)
      navigate('home')
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
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
            NexEcoms
          </p>
          <p className="text-xs text-muted-foreground">Medical Equipment Solutions</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-brand-ink">Create Account</CardTitle>
            <CardDescription>
              Join NexEcoms to enquire, track orders &amp; save your favourites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-fn" className="text-sm font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-fn"
                      value={form.firstName}
                      onChange={update('firstName')}
                      onBlur={markTouched('firstName')}
                      placeholder="John"
                      className="pl-9"
                      required
                    />
                  </div>
                  {touched.firstName && errors.firstName && (
                    <p className="text-xs text-red-500">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-ln" className="text-sm font-medium">
                    Last Name
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-ln"
                      value={form.lastName}
                      onChange={update('lastName')}
                      placeholder="Doe"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm font-medium">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    onBlur={markTouched('email')}
                    placeholder="you@example.com"
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
                {touched.email && errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-phone" className="text-sm font-medium">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-phone"
                    type="tel"
                    value={form.phone}
                    onChange={update('phone')}
                    placeholder="+971 50 123 4567"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-pwd" className="text-sm font-medium">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-pwd"
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={update('password')}
                    onBlur={markTouched('password')}
                    placeholder="At least 6 characters"
                    className="pl-9 pr-9"
                    autoComplete="new-password"
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
                {touched.password && errors.password && (
                  <p className="text-xs text-red-500">{errors.password}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-cpwd" className="text-sm font-medium">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-cpwd"
                    type={showPwd ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={update('confirmPassword')}
                    onBlur={markTouched('confirmPassword')}
                    placeholder="Re-enter password"
                    className="pl-9"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <p className="text-xs text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-teal text-white hover:bg-brand-teal-dark"
                size="lg"
              >
                {loading ? (
                  'Creating account...'
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
            </form>

            {/* Benefits */}
            <ul className="mt-5 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                Faster enquiry checkout
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                Track order history
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                Save your wishlist
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-teal" />
                Exclusive offers
              </li>
            </ul>

            <Separator className="my-5" />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={() => navigate('login')}
                className="font-semibold text-brand-teal hover:underline"
              >
                <ArrowLeft className="mr-1 inline h-3 w-3" />
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
