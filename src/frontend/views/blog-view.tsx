'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Send, ArrowRight, CalendarDays, User } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { formatDate } from '@/frontend/lib/format'
import type { BlogPost } from '@/shared/types'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'

import { Label } from '@/frontend/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/frontend/components/ui/pagination'
import { toast } from 'sonner'

const POSTS_PER_PAGE = 6

export function BlogView() {
  const { navigate } = useStore()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [newsletterEmail, setNewsletterEmail] = useState('')

  useEffect(() => {
    api.blog({ limit: 50 })
      .then(setPosts)
      .catch(() => toast.error('Failed to load blog posts'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((p) => set.add(p.category))
    return Array.from(set)
  }, [posts])

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.excerpt || '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !activeCategory || p.category === activeCategory
      return matchSearch && matchCat
    })
  }, [posts, search, activeCategory])

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  )

  const featured = currentPage === 1 && !search && !activeCategory ? paginated[0] : null
  const restPosts = featured ? paginated.slice(1) : paginated

  const recentPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 5)
  }, [posts])

  const updateSearch = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const updateCategory = (cat: string | null) => {
    setActiveCategory(cat)
    setPage(1)
  }

  const subscribe = async () => {
    if (!newsletterEmail) {
      toast.error('Please enter your email')
      return
    }
    try {
      await api.newsletter(newsletterEmail)
      toast.success('Subscribed successfully!')
      setNewsletterEmail('')
    } catch {
      toast.error('Subscription failed')
    }
  }

  return (
    <div className="bg-brand-bg">
      {/* Header */}
      <section className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            Store Insights
          </span>
          <h1 className="mt-4 text-4xl font-bold md:text-5xl">From Our Blog</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/80">
            Expert insights, healthcare tips, and the latest in medical equipment from the NexEcoms team.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  No posts found. Try a different search or category.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Featured post */}
                {featured && (
                  <article
                    className="group mb-10 overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer"
                    onClick={() => navigate('blog-detail', { slug: featured.slug })}
                  >
                    <div className="grid md:grid-cols-2">
                      <div className="relative h-64 overflow-hidden md:h-auto">
                        <img
                          src={featured.coverImageUrl || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800'}
                          alt={featured.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="absolute left-4 top-4 rounded-full bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                          Featured
                        </span>
                      </div>
                      <div className="flex flex-col justify-center gap-3 p-6">
                        <span className="inline-block w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-brand-teal">
                          {featured.category}
                        </span>
                        <h2 className="text-2xl font-bold leading-tight text-brand-ink group-hover:text-brand-teal">
                          {featured.title}
                        </h2>
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {featured.excerpt}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={12} /> {formatDate(featured.publishedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={12} /> {featured.authorName}
                          </span>
                        </div>
                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal">
                          Read More <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </article>
                )}

                {/* Post grid */}
                <div className="grid gap-6 sm:grid-cols-2">
                  {restPosts.map((post) => (
                    <article
                      key={post.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer"
                      onClick={() => navigate('blog-detail', { slug: post.slug })}
                    >
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={post.coverImageUrl || 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600'}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="absolute left-3 top-3 rounded-full bg-brand-teal/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                          {post.category}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        <h3 className="line-clamp-2 text-lg font-bold leading-snug text-brand-ink group-hover:text-brand-teal">
                          {post.title}
                        </h3>
                        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                          {post.excerpt}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={12} /> {formatDate(post.publishedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-brand-teal">
                            Read <ArrowRight size={12} />
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination className="mt-10">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setPage((p) => Math.max(1, p - 1))
                          }}
                          aria-disabled={currentPage === 1}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === i + 1}
                            onClick={(e) => {
                              e.preventDefault()
                              setPage(i + 1)
                            }}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setPage((p) => Math.min(totalPages, p + 1))
                          }}
                          aria-disabled={currentPage === totalPages}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    type="search"
                    placeholder="Search blog..."
                    value={search}
                    onChange={(e) => updateSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Recent Posts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Posts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentPosts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate('blog-detail', { slug: p.slug })}
                    className="flex w-full gap-3 text-left group"
                  >
                    <img
                      src={p.coverImageUrl || 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=120'}
                      alt={p.title}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h4 className="line-clamp-2 text-sm font-medium leading-tight group-hover:text-brand-teal">
                        {p.title}
                      </h4>
                      <span className="text-xs text-muted-foreground">{formatDate(p.publishedAt)}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateCategory(null)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      !activeCategory
                        ? 'bg-brand-teal text-white'
                        : 'bg-accent text-brand-teal hover:bg-brand-teal/10'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => updateCategory(cat)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeCategory === cat
                          ? 'bg-brand-teal text-white'
                          : 'bg-accent text-brand-teal hover:bg-brand-teal/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Newsletter */}
            <Card className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
              <CardHeader>
                <CardTitle className="text-base text-white">Newsletter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-white/80">
                  Get the latest healthcare insights and product updates delivered to your inbox.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="sidebar-email" className="sr-only">
                    Email address
                  </Label>
                  <Input
                    id="sidebar-email"
                    type="email"
                    placeholder="Enter your email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/60"
                  />
                  <Button
                    onClick={subscribe}
                    className="w-full bg-brand-gold hover:bg-amber-600"
                  >
                    <Send size={14} /> Subscribe
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Back to home */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault()
              navigate('home')
            }}
            className="text-sm text-muted-foreground hover:text-brand-teal"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
