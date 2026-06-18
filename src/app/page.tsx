'use client'

import { useEffect } from 'react'
import { useStore, applyLangDir } from '@/store/use-store'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { CartDrawer } from '@/components/cart/cart-drawer'
import { WhatsAppFloat } from '@/components/layout/whatsapp-float'
import { QuickViewModal } from '@/components/product/quick-view-modal'
import { CompareBar } from '@/components/product/compare-bar'

import { HomeView } from '@/components/views/home-view'
import { ProductsView } from '@/components/views/products-view'
import { ProductDetailView } from '@/components/views/product-detail-view'
import { CartView } from '@/components/views/cart-view'
import { WishlistView } from '@/components/views/wishlist-view'
import { CompareView } from '@/components/views/compare-view'
import { BlogView } from '@/components/views/blog-view'
import { BlogDetailView } from '@/components/views/blog-detail-view'
import { AboutView } from '@/components/views/about-view'
import { ContactView } from '@/components/views/contact-view'
import { StoreLocationsView } from '@/components/views/store-locations-view'
import { FaqView } from '@/components/views/faq-view'
import { ShippingView } from '@/components/views/shipping-view'
import { TermsView } from '@/components/views/terms-view'
import { PrivacyView } from '@/components/views/privacy-view'
import { LoginView } from '@/components/views/login-view'
import { RegisterView } from '@/components/views/register-view'
import { ProfileView } from '@/components/views/profile-view'
import { AdminView } from '@/components/views/admin-view'

export default function Home() {
  const { view, lang, settings, setSettings, compareList } = useStore()

  useEffect(() => {
    applyLangDir(lang)
  }, [lang])

  useEffect(() => {
    if (Object.keys(settings).length === 0) {
      fetch('/api/settings').then((r) => r.json()).then(setSettings).catch(() => {})
    }
  }, [settings, setSettings])

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
      default: return <HomeView />
    }
  }

  const isAdmin = view === 'admin'
  const showCompareBar = !isAdmin && view !== 'compare' && compareList.length > 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isAdmin && <Header />}
      <main className={`flex-1 ${showCompareBar ? 'pb-20' : ''}`}>{renderView()}</main>
      {!isAdmin && <Footer />}
      {!isAdmin && <CartDrawer />}
      {!isAdmin && <WhatsAppFloat />}
      {!isAdmin && <QuickViewModal />}
      {showCompareBar && <CompareBar />}
    </div>
  )
}
