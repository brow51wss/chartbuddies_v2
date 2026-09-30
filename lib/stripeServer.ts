import getConfig from 'next/config'
import Stripe from 'stripe'

export function stripeRuntimeConfig() {
  const { serverRuntimeConfig } = getConfig() || {}
  return {
    secretKey: serverRuntimeConfig?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: serverRuntimeConfig?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '',
    priceFacility: serverRuntimeConfig?.STRIPE_PRICE_FACILITY || process.env.STRIPE_PRICE_FACILITY || '',
    priceExtraNurse: serverRuntimeConfig?.STRIPE_PRICE_EXTRA_NURSE || process.env.STRIPE_PRICE_EXTRA_NURSE || '',
  }
}

export function isStripeConfigured(): boolean {
  const cfg = stripeRuntimeConfig()
  return Boolean(cfg.secretKey && cfg.priceFacility && cfg.priceExtraNurse)
}

export function getStripe(): Stripe {
  const { secretKey } = stripeRuntimeConfig()
  if (!secretKey) {
    throw new Error('Stripe is not configured')
  }
  return new Stripe(secretKey)
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.lasso-app.com'
}
