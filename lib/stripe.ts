import Stripe from 'stripe';

// Initialize Stripe with your secret key
// Make sure to add STRIPE_SECRET_KEY to your .env.local file
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
};
