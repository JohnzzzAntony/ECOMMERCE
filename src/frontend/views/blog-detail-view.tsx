'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import {
  CalendarDays,
  User,
  Clock,
  ArrowRight,
  ChevronRight,
  Home as HomeIcon,
  MessageCircle,
  Facebook,
  Link2,
  ArrowLeft,
} from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { formatDate } from '@/frontend/lib/format'
import type { BlogPost } from '@/shared/types'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { toast } from 'sonner'

export function BlogDetailView() {
  const { params, navigate } = useStore()
  const slug = params.slug as string | undefined

  const [dataBySlug, setDataBySlug] = useState<
    Record<string, { post: BlogPost; related: BlogPost[] }>
  >({})
  const [failedSlugs, setFailedSlugs] = useState<Record<string, boolean>>({})

  const cached = slug ? dataBySlug[slug] : undefined
  const related = cached?.related ?? []
  const post = cached?.post
  const loading = !!slug && !failedSlugs[slug!] && !cached
  const notFound = !slug || !!failedSlugs[slug ?? '']

  useEffect(() => {
    if (!slug) return
    if (dataBySlug[slug] || failedSlugs[slug]) return // already handled
    let active = true
    api
      .blogPost(slug)
      .then((data) => {
        if (!active) return
        setDataBySlug((prev) => ({
          ...prev,
          [slug]: { post: data.post, related: data.related || [] },
        }))
      })
      .catch(() => {
        if (!active) return
        setFailedSlugs((prev) => ({ ...prev, [slug]: true }))
      })
    return () => {
      active = false
    }
  }, [slug, dataBySlug, failedSlugs])

  const readTime = (content: string) => {
    const words = content.trim().split(/\s+/).length
    return Math.max(1, Math.round(words / 200))
  }

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?post=${slug || ''}` : ''
  const shareText = post ? encodeURIComponent(post.title) : ''

  const copyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="mt-8 space-y-3">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-brand-ink">Post Not Found</h1>
        <p className="mt-3 text-muted-foreground">
          The article you are looking for does not exist or has been removed.
        </p>
        <Button className="mt-6" onClick={() => navigate('blog')}>
          <ArrowLeft size={16} /> Back to Blog
        </Button>
      </div>
    )
  }

  const tags = post.tags ? post.tags.split(',').map((t) => t.trim()).filter(Boolean) : []

  return (
    <div className="bg-brand-bg">
      {/* Breadcrumb */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3 text-sm text-muted-foreground">
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-1 hover:text-brand-teal"
          >
            <HomeIcon size={14} /> Home
          </button>
          <ChevronRight size={14} />
          <button onClick={() => navigate('blog')} className="hover:text-brand-teal">
            Blog
          </button>
          <ChevronRight size={14} />
          <span className="line-clamp-1 text-brand-ink">{post.title}</span>
        </div>
      </div>

      {/* Hero */}
      <article>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <span className="inline-block rounded-full bg-brand-teal px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {post.category}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-brand-ink md:text-4xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User size={14} className="text-brand-teal" /> {post.authorName}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-brand-teal" /> {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-brand-teal" /> {readTime(post.content)} min read
            </span>
          </div>
        </div>

        {/* Cover image */}
        <div className="mx-auto max-w-5xl px-4">
          <div className="overflow-hidden rounded-2xl shadow-lg">
            <img
              src={post.coverImageUrl || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200'}
              alt={post.title}
              className="h-64 w-full object-cover md:h-[460px]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="blog-prose">
            <ReactMarkdown
              components={{
                h2: ({ ...props }) => (
                  <h2 className="mt-10 mb-4 text-2xl font-bold text-brand-ink" {...props} />
                ),
                h3: ({ ...props }) => (
                  <h3 className="mt-6 mb-3 text-xl font-bold text-brand-ink" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="mb-5 leading-relaxed text-brand-ink/80" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="mb-5 list-disc space-y-2 pl-6 text-brand-ink/80" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="mb-5 list-decimal space-y-2 pl-6 text-brand-ink/80" {...props} />
                ),
                li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                strong: ({ ...props }) => (
                  <strong className="font-semibold text-brand-ink" {...props} />
                ),
                a: ({ ...props }) => (
                  <a className="text-brand-teal underline hover:text-brand-teal-dark" {...props} />
                ),
                blockquote: ({ ...props }) => (
                  <blockquote
                    className="my-6 border-l-4 border-brand-gold bg-accent/50 p-4 italic text-brand-ink/80"
                    {...props}
                  />
                ),
                code: ({ ...props }) => (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-brand-teal-dark" {...props} />
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center gap-2 border-t pt-6">
              <span className="text-sm font-semibold text-brand-ink">Tags:</span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-brand-teal"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
            <span className="text-sm font-semibold text-brand-ink">Share this article:</span>
            <a
              href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
              aria-label="Share on WhatsApp"
            >
              <MessageCircle size={16} />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white transition-colors hover:opacity-90"
              aria-label="Share on Facebook"
            >
              <Facebook size={16} />
            </a>
            <button
              onClick={copyLink}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal text-white transition-colors hover:bg-brand-teal-dark"
              aria-label="Copy link"
            >
              <Link2 size={16} />
            </button>
          </div>

          {/* Back to blog */}
          <div className="mt-8 text-center">
            <Button variant="outline" onClick={() => navigate('blog')}>
              <ArrowLeft size={16} /> Back to Blog
            </Button>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="border-t bg-white py-12">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="mb-8 text-2xl font-bold text-brand-ink">Related Articles</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.slice(0, 3).map((rp) => (
                <Card
                  key={rp.id}
                  className="group cursor-pointer overflow-hidden py-0 transition-all hover:shadow-md"
                  onClick={() => navigate('blog-detail', { slug: rp.slug })}
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={rp.coverImageUrl || 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600'}
                      alt={rp.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-brand-teal/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      {rp.category}
                    </span>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="line-clamp-2 font-bold leading-snug text-brand-ink group-hover:text-brand-teal">
                      {rp.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{rp.excerpt}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} /> {formatDate(rp.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-brand-teal">
                        Read <ArrowRight size={12} />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* hidden util link to satisfy Link import typing */}
      <Link href="/" className="sr-only">
        Home
      </Link>
    </div>
  )
}
