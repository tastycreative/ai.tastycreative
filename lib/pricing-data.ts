export interface PricingPlan {
  name: string; // Database plan name (e.g., "starter")
  displayName?: string; // Display name for UI (e.g., "Starter Plan")
  price: string;
  period: string;
  credits: string;
  features: string[];
  badge?: string;
  cta?: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "starter", // Must match database plan name exactly
    displayName: "Starter Plan",
    price: "$79",
    period: "/month",
    credits: "500 Credits included",
    features: [
      "1 custom character",
      "Basic AI content generation",
      "Standard support",
      "Basic analytics",
      "Social media optimization",
      "Content calendar access",
    ],
  },
  {
    name: "growth", // Must match database plan name exactly
    displayName: "Growth Plan",
    price: "$299",
    period: "/month",
    credits: "750 Credits included",
    badge: "Save 15% compared to Starter",
    features: [
      "3 custom characters",
      "Advanced AI content generation",
      "Priority support",
      "Advanced analytics",
      "Enhanced social media optimization",
      "Advanced content calendar",
    ],
  },
  {
    name: "pro", // Must match database plan name exactly
    displayName: "Pro Plan",
    price: "$699",
    period: "/month",
    credits: "2000 Credits included",
    badge: "Save 30% compared to Starter",
    features: [
      "10 custom characters",
      "Premium AI content generation",
      "24/7 priority support",
      "Advanced analytics & insights",
      "Full social media optimization",
      "Advanced content calendar",
      "Custom branding & templates",
    ],
  },
  {
    name: "enterprise", // Must match database plan name exactly
    displayName: "Enterprise Plan",
    price: "Custom",
    period: "",
    credits:
      "Need a tailored solution for your organization? Let's build something amazing together.",
    features: [
      "Customized for your needs",
      "Scalable solutions",
      "Dedicated support team",
    ],
    cta: "Get in Touch",
  },
];
