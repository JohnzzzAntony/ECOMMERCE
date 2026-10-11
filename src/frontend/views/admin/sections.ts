import {
  Building2, FileStack, FileText, Menu, Palette, Image as ImageIcon, LayoutDashboard, Mail, Package, Settings, ShoppingCart, Star, Users,
} from 'lucide-react'

export type SectionKey =
  | 'dashboard' | 'products' | 'orders' | 'users' | 'blog'
  | 'media' | 'testimonials' | 'clients' | 'newsletter' | 'themes' | 'pages' | 'navigation' | 'settings'

export const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; subtitle: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, subtitle: 'Overview of your store performance' },
  { key: 'products', label: 'Products', icon: Package, subtitle: 'Catalog, categories and brands' },
  { key: 'orders', label: 'Orders & Enquiries', icon: ShoppingCart, subtitle: 'Track orders and answer quote requests' },
  { key: 'users', label: 'Users', icon: Users, subtitle: 'Staff and customer accounts' },
  { key: 'blog', label: 'Blog', icon: FileText, subtitle: 'Articles, drafts and publishing' },
  { key: 'media', label: 'Media', icon: ImageIcon, subtitle: 'Homepage slides and gallery' },
  { key: 'testimonials', label: 'Testimonials', icon: Star, subtitle: 'Customer quotes' },
  { key: 'clients', label: 'Clients', icon: Building2, subtitle: 'Partner logos' },
  { key: 'newsletter', label: 'Newsletter', icon: Mail, subtitle: 'Email subscribers' },
  { key: 'themes', label: 'Themes', icon: Palette, subtitle: 'Install, publish and customize storefront themes' },
  { key: 'pages', label: 'Pages', icon: FileStack, subtitle: 'Custom content pages' },
  { key: 'navigation', label: 'Navigation', icon: Menu, subtitle: 'Header and footer menus' },
  { key: 'settings', label: 'Settings', icon: Settings, subtitle: 'Store details, SEO, social, payments, shipping' },
]
