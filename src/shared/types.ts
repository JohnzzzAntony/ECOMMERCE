// Shared TypeScript types for NexEcoms

export interface ProductImage {
  id: string
  imageUrl: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  nameAr: string | null
  description: string | null
  shortDescription: string | null
  specifications: string | null
  sku: string | null
  regularPrice: number
  salePrice: number | null
  onSale: boolean
  stockQty: number
  inStock: boolean
  categoryId: string | null
  brandId: string | null
  isFeatured: boolean
  isExclusive: boolean
  badge?: string | null
  metaTitle: string | null
  metaDescription?: string | null
  metaKeywords?: string | null
  descriptionAr?: string | null
  barcode?: string | null
  ratingAvg: number
  ratingCount: number
  createdAt: string
  category?: Category | null
  brand?: Brand | null
  images: ProductImage[]
  reviews?: ProductReview[]
  collections?: { id: string }[]
  /** JSON of custom field values (admin). */
  attributes?: string
  /** Storefront detail only: custom fields that have a value. */
  extraFields?: { label: string; value: string }[]
}

export interface ProductReview {
  id: string
  authorName: string
  rating: number
  reviewText: string | null
  createdAt: string
  isApproved: boolean
}

export interface Category {
  id: string
  slug: string
  name: string
  nameAr: string | null
  imageUrl: string | null
  icon: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
  parent?: Category | null
  children?: Category[]
  /** Admin list only: full path, e.g. "Health & Beauty › Perfumes". */
  path?: string
  _count?: { products: number }
}

export interface Brand {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  description: string | null
  isActive: boolean
  _count?: { products: number }
}

export interface Collection {
  id: string
  slug: string
  name: string
  nameAr: string | null
  bannerImageUrl: string | null
  description: string | null
  isActive: boolean
  sortOrder: number
  _count?: { products: number }
}

export interface BlogPost {
  id: string
  slug: string
  title: string
  titleAr: string | null
  excerpt: string | null
  content: string
  category: string
  tags: string | null
  authorName: string
  coverImageUrl: string | null
  isPublished: boolean
  publishedAt: string
}

export interface Testimonial {
  id: string
  name: string
  role: string | null
  avatarUrl: string | null
  content: string
  rating: number
  sortOrder: number
  isActive: boolean
}

export interface ClientLogo {
  id: string
  name: string
  logoUrl: string | null
  websiteUrl: string | null
  sortOrder: number
  isActive: boolean
}

export interface HeroSlide {
  id: string
  imageUrl: string
  title: string | null
  subtitle: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  sortOrder: number
  isActive: boolean
}

export interface GalleryItem {
  id: string
  imageUrl: string
  caption: string | null
  category: string
  sortOrder: number
  isActive: boolean
}

export interface CartItem {
  id: string
  productId: string
  quantity: number
  notes: string | null
  product: Product
}

export interface SiteSettings {
  [key: string]: string
}

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  email: string
  phone: string | null
  total: number
  shippingAddress: string
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  notes: string | null
  createdAt: string
  items: OrderItem[]
}

export interface OrderItem {
  id: string
  productName: string
  sku: string | null
  unitPrice: number
  qty: number
  subtotal: number
}

export interface Enquiry {
  id: string
  customerName: string
  email: string
  phone: string | null
  company: string | null
  message: string | null
  status: string
  total: number
  itemsJson: string
  createdAt: string
}

export interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  role: string
}
