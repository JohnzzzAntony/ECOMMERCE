export { POST } from '@/backend/routes/orders/stripe-webhook'

// Stripe signs the raw body; never cache or pre-render this endpoint.
export const dynamic = 'force-dynamic'
