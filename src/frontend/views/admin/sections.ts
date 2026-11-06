import {
  Building2, FileStack, LayoutTemplate, Palette as Swatches, Images, FileText, Menu, Palette, Image as ImageIcon, LayoutDashboard, Mail, Package, Settings, ShoppingCart, Star, Users,
} from 'lucide-react'

export type SectionKey =
  | 'dashboard' | 'products' | 'orders' | 'users' | 'blog'
  | 'media' | 'testimonials' | 'clients' | 'newsletter' | 'themes' | 'pages' | 'navigation' | 'store-pages' | 'design-system' | 'media-library' | 'settings'

export const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; subtitle: string; group?: 'Online Store' | 'Design' }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, subtitle: 'Overview of your store performance' },
  { key: 'products', label: 'Products', icon: Package, subtitle: 'Catalog, categories and brands' },
  { key: 'orders', label: 'Orders & Enquiries', icon: ShoppingCart, subtitle: 'Track orders and answer quote requests' },
  { key: 'users', label: 'Users', icon: Users, subtitle: 'Staff and customer accounts' },
  { key: 'media', label: 'Media', icon: ImageIcon, subtitle: 'Homepage slides and gallery' },
  { key: 'testimonials', label: 'Testimonials', icon: Star, subtitle: 'Customer quotes' },
  { key: 'clients', label: 'Clients', icon: Building2, subtitle: 'Partner logos' },
  { key: 'newsletter', label: 'Newsletter', icon: Mail, subtitle: 'Email subscribers' },
  { key: 'themes', label: 'Themes', icon: Palette, subtitle: 'Install, publish and customize storefront themes', group: 'Online Store' },
  { key: 'pages', label: 'Pages', icon: FileStack, subtitle: 'Custom content pages', group: 'Online Store' },
  { key: 'navigation', label: 'Navigation', icon: Menu, subtitle: 'Header and footer menus', group: 'Online Store' },
  { key: 'blog', label: 'Blog posts', icon: FileText, subtitle: 'Articles, drafts and publishing', group: 'Online Store' },
  { key: 'store-pages', label: 'Store pages', icon: LayoutTemplate, subtitle: 'Edit, preview and publish pages built from sections', group: 'Design' },
  { key: 'design-system', label: 'Design system', icon: Swatches, subtitle: 'Colours, typography, spacing and fonts', group: 'Design' },
  { key: 'media-library', label: 'Media library', icon: Images, subtitle: 'Images and icons; alt text', group: 'Design' },
  { key: 'settings', label: 'Settings', icon: Settings, subtitle: 'Store details, SEO, social, payments, shipping' },
]
