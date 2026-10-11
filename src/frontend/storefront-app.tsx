'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, applyLangDir } from '@/frontend/store/use-store'
import { Header } from '@/frontend/components/layout/header'
import { Footer } from '@/frontend/components/layout/footer'
import { CartDrawer } from '@/frontend/components/cart/cart-drawer'
import { WhatsAppFloat } from '@/frontend/components/layout/whatsapp-float'
import { BackToTop } from '@/frontend/components/layout/back-to-top'
import { QuickViewModal } from '@/frontend/components/product/quick-view-modal'
import { CompareBar } from '@/frontend/components/product/compare-bar'

import { HomeView } from '@/frontend/views/home-view'
import { ProductsView } from '@/frontend/views/products-view'
import { ProductDetailView } from '@/frontend/views/product-detail-view'
import { CartView } from '@/frontend/views/cart-view'
import { WishlistView } from '@/frontend/views/wishlist-view'
import { CompareView } from '@/frontend/views/compare-view'
import { BlogView } from '@/frontend/views/blog-view'
import { BlogDetailView } from '@/frontend/views/blog-detail-view'
import { AboutView } from '@/frontend/views/about-view'
import { ContactView } from '@/frontend/views/contact-view'
import { StoreLocationsView } from '@/frontend/views/store-locations-view'
import { FaqView } from '@/frontend/views/faq-view'
import { ShippingView } from '@/frontend/views/shipping-view'
import { TermsView } from '@/frontend/views/terms-view'
import { PrivacyView } from '@/frontend/views/privacy-view'
import { LoginView } from '@/frontend/views/login-view'
import { RegisterView } from '@/frontend/views/register-view'
import { ProfileView } from '@/frontend/views/profile-view'
import { AdminView } from '@/frontend/views/admin'
import { TrackOrderView } from '@/frontend/views/track-order-view'
import { PageView } from '@/frontend/views/page-view'
import { ThemeContext } from '@/frontend/lib/theme'
import { styleText, themeVariablesCss, type StorefrontTheme } from '@/shared/theme'

// Single-page storefront: the Zustand store's `view` decides which screen renders.
// `initialTheme` is the active theme rendered on the server, so theme styles apply on first paint.
export function StorefrontApp({ initialTheme, initialSettings }: { initialTheme?: StorefrontTheme | null; initialSettings?: Record<string, string> | null }) {
  const { view, params, lang, setSettings, compareList, toggleWishlist, navigate, pageHidesChrome } = useStore()
  const storeTheme = useStore((s) => s.theme)
  const theme = storeTheme ?? initialTheme ?? null

  // Deep link to a custom page: /?page=<slug>
  useEffect(() => {
    const slug = new URL(window.location.href).searchParams.get('page')
    if (slug) navigate('page', { slug })
  }, [navigate])

  useEffect(() => {
    applyLangDir(lang)
  }, [lang])

  // Store settings come with the server render; fetch only if that failed. Runs once.
  useEffect(() => {
    if (initialSettings) setSettings(initialSettings)
    else fetch('/api/settings').then((r) => r.json()).then(setSettings).catch(() => {})
  }, [initialSettings, setSettings])

  // Import wishlist from shared link (?wishlist=slug1,slug2,...)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const wishlistParam = url.searchParams.get('wishlist')
    if (wishlistParam) {
      const slugs = wishlistParam.split(',').filter(Boolean)
      fetch(`/api/products?slugs=${slugs.map(encodeURIComponent).join(',')}`)
        .then((r) => r.json())
        .then(({ products }) => {
          const matched = products.filter((p: any) => slugs.includes(p.slug))
          matched.forEach((p: any) => {
            if (!useStore.getState().wishlist.includes(p.id)) {
              toggleWishlist(p.id)
            }
          })
          // Clean the URL
          url.searchParams.delete('wishlist')
          window.history.replaceState({}, '', url.toString())
          if (matched.length > 0) {
            import('sonner').then(({ toast }) => {
              toast.success(`${matched.length} product(s) imported to your wishlist!`)
            })
            navigate('wishlist')
          }
        })
        .catch(() => {})
    }
  }, [toggleWishlist, navigate])

  const renderView = () => {
    switch (view) {
      case 'home': return <HomeView />
      case 'products':
      case 'products-category':
      case 'products-brand':
      case 'products-collection':
      case 'products-search':
      case 'offers': return <ProductsView />
      case 'product-detail': return <ProductDetailView />
      case 'cart': return <CartView />
      case 'wishlist': return <WishlistView />
      case 'compare': return <CompareView />
      case 'blog': return <BlogView />
      case 'blog-detail': return <BlogDetailView />
      case 'about': return <AboutView />
      case 'contact': return <ContactView />
      case 'store-locations': return <StoreLocationsView />
      case 'faq': return <FaqView />
      case 'shipping-info': return <ShippingView />
      case 'terms': return <TermsView />
      case 'privacy': return <PrivacyView />
      case 'login': return <LoginView />
      case 'register': return <RegisterView />
      case 'profile': return <ProfileView />
      case 'admin': return <AdminView />
      case 'track-order': return <TrackOrderView />
      case 'page': return <PageView />
      default: return <HomeView />
    }
  }

  const isAdmin = view === 'admin'
  const chromeHidden = isAdmin
    || (view === 'page' && pageHidesChrome)
    || (view === 'home' && theme?.settings.hide_chrome_on_home === true)
  const showCompareBar = !chromeHidden && view !== 'compare' && compareList.length > 0
  const themeCss = theme ? `${themeVariablesCss(theme.schema, theme.settings)}\n${theme.css}` : ''

  return (
    <ThemeContext.Provider value={theme}>
    {themeCss && !isAdmin && <style id="theme-css" dangerouslySetInnerHTML={{ __html: styleText(themeCss) }} />}
    <div className="flex min-h-screen flex-col bg-background">
      {!chromeHidden && <Header />}
      <main className={`flex-1 ${showCompareBar ? 'pb-20' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view + JSON.stringify(params)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
      {!chromeHidden && <Footer />}
      {!isAdmin && <CartDrawer />}
      {!chromeHidden && <WhatsAppFloat />}
      {!chromeHidden && <BackToTop />}
      {!isAdmin && <QuickViewModal />}
      {showCompareBar && <CompareBar />}
    </div>
    </ThemeContext.Provider>
  )
}
