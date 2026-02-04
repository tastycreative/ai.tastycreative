// One-time credit purchase packages
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  stripePriceId?: string; // You'll need to create these in Stripe Dashboard
  popular?: boolean;
  bonus?: number; // Bonus credits for larger packages
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'credits_100',
    name: '100 Credits',
    credits: 100,
    price: 20, // $0.20 per credit
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID,
  },
  {
    id: 'credits_500',
    name: '500 Credits',
    credits: 500,
    price: 90, // $0.18 per credit
    bonus: 50, // Total: 550 credits = $0.164 per credit
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID,
  },
  {
    id: 'credits_1000',
    name: '1,000 Credits',
    credits: 1000,
    price: 160, // $0.16 per credit
    bonus: 100, // Total: 1,100 credits = $0.145 per credit
    popular: true,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_1000_PRICE_ID,
  },
  {
    id: 'credits_5000',
    name: '5,000 Credits',
    credits: 5000,
    price: 700, // $0.14 per credit
    bonus: 750, // Total: 5,750 credits = $0.122 per credit
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_5000_PRICE_ID,
  },
];
