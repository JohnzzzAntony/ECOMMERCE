// Section type → component, loaded on demand so a page only ships the code of the sections it uses.
import type { ComponentType } from 'react'
import type { SectionType } from '@/shared/sections/registry'
import type { SectionProps } from './shared'

type Loader = () => Promise<{ default: ComponentType<SectionProps> }>

export const SECTION_COMPONENTS: Record<SectionType, Loader> = {
  'announcement-bar': () => import('./announcement-bar'),
  header: () => import('./header'),
  footer: () => import('./footer'),
  hero: () => import('./hero'),
  'hero-slideshow': () => import('./hero-slideshow'),
  'image-with-text': () => import('./image-with-text'),
  'rich-text': () => import('./rich-text'),
  'feature-grid': () => import('./feature-grid'),
  'collection-list': () => import('./collection-list'),
  'product-grid': () => import('./product-grid'),
  'product-detail': () => import('./product-detail'),
  cart: () => import('./cart'),
  testimonials: () => import('./testimonials'),
  'logo-cloud': () => import('./logo-cloud'),
  faq: () => import('./faq'),
  newsletter: () => import('./newsletter'),
  'cta-banner': () => import('./cta-banner'),
  video: () => import('./video'),
  gallery: () => import('./gallery'),
  spacer: () => import('./spacer'),
  freeform: () => import('./freeform'),
  'custom-code': () => import('./custom-code'),
}

export type { SectionProps }
