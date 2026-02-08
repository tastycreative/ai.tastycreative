import Stripe from 'stripe';

// Lazy initialization of Stripe to avoid build-time errors
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables. ' +
        'Please add it to your .env file.'
      );
    }

    _stripe = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }

  return _stripe;
}

// Export a getter function instead of the instance
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  }
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
};
