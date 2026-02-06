# Credit System Documentation

## Overview

The credit system allows you to manage and track credit consumption for different features in your application. Each feature can have its own credit cost, and credits are automatically deducted when users use features.

## Database Schema

### FeatureCreditPricing Model

```prisma
model FeatureCreditPricing {
  id          String   @id @default(cuid())
  featureKey  String   @unique // e.g., "seedream_text_to_image"
  featureName String   // Display name: "SeeDream Text to Image"
  category    String   // e.g., "Video Generation", "Image Generation"
  credits     Int      // Cost in credits
  description String?  // Optional description
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Setup

### 1. Run Database Migration

```bash
npx prisma db push
npx prisma generate
```

### 2. Access Admin Panel

Navigate to: `/{tenant}/admin/feature-pricing`

Only users with `isAdmin: true` can access this page.

### 3. Add Feature Pricing

Click "Add Feature" and fill in:
- **Feature Key**: Unique identifier (e.g., `seedream_text_to_image`)
- **Feature Name**: Display name (e.g., "SeeDream Text to Image")
- **Category**: Group features (e.g., "Image Generation")
- **Credits**: Cost in credits
- **Description**: Optional description
- **Active**: Whether the pricing is active

### 4. Copy Feature Key

Click the copy button next to the feature key to copy it for use in your code.

## Usage in Features

### Example: Image Generation API

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deductCredits } from '@/lib/credits';
import { prisma } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // STEP 1: Deduct credits BEFORE processing
    const creditResult = await deductCredits(
      user.currentOrganizationId,
      'seedream_text_to_image', // Feature key from admin panel
      user.id // Optional: track which user used the feature
    );

    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error },
        { status: 402 } // 402 Payment Required
      );
    }

    // STEP 2: Process the feature
    try {
      // Your feature logic here
      const result = await generateImage(/* params */);

      return NextResponse.json({
        success: true,
        result,
        creditsDeducted: creditResult.creditsDeducted,
        remainingCredits: creditResult.remainingCredits,
      });
    } catch (error) {
      // STEP 3: IMPORTANT - Refund credits if processing fails
      await refundCredits(
        user.currentOrganizationId,
        creditResult.creditsDeducted!
      );

      throw error;
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
```

### Example: Check Credits Before Starting

```typescript
import { checkCredits } from '@/lib/credits';

// In your component or API
const creditCheck = await checkCredits(
  organizationId,
  'kling_image_to_video'
);

if (!creditCheck.hasEnough) {
  toast.error(`Insufficient credits. Required: ${creditCheck.required}, Available: ${creditCheck.available}`);
  return;
}

// Proceed with feature...
```

### Example: Display Credit Cost in UI

```typescript
import { getFeaturePricing } from '@/lib/credits';

// In your component
const [pricing, setPricing] = useState(null);

useEffect(() => {
  const fetchPricing = async () => {
    const data = await getFeaturePricing('seedream_text_to_image');
    setPricing(data);
  };
  fetchPricing();
}, []);

// Display in UI
{pricing && (
  <p className="text-sm text-gray-600">
    Cost: {pricing.credits} credits
  </p>
)}
```

## Helper Functions

### `deductCredits(organizationId, featureKey, userId?)`

Deducts credits from an organization for using a feature.

**Parameters:**
- `organizationId` (string): The organization ID
- `featureKey` (string): The feature key (e.g., 'seedream_text_to_image')
- `userId` (string, optional): User ID for tracking

**Returns:**
```typescript
{
  success: boolean;
  remainingCredits?: number;
  creditsDeducted?: number;
  error?: string;
}
```

### `checkCredits(organizationId, featureKey)`

Checks if an organization has enough credits for a feature.

**Parameters:**
- `organizationId` (string): The organization ID
- `featureKey` (string): The feature key

**Returns:**
```typescript
{
  hasEnough: boolean;
  required: number;
  available: number;
  error?: string;
}
```

### `getFeaturePricing(featureKey)`

Gets feature pricing information.

**Parameters:**
- `featureKey` (string): The feature key

**Returns:** FeaturePricing object or null

## Best Practices

1. **Always deduct credits BEFORE processing** - This prevents users from using features without credits.

2. **Refund credits on failure** - If the feature processing fails after deducting credits, refund them to maintain fairness.

3. **Show credit cost in UI** - Display the credit cost before users trigger the feature.

4. **Handle insufficient credits gracefully** - Show clear error messages when users don't have enough credits.

5. **Track usage** - The system automatically logs usage in `UsageLog` for analytics.

## Feature Key Naming Convention

Use lowercase with underscores:
- `seedream_text_to_image`
- `kling_image_to_video`
- `kling_multi_image_to_video`
- `ai_voice_generation`
- `face_swap`

## Categories

Organize features by category:
- **Image Generation**
- **Video Generation**
- **AI Voice**
- **Advanced Tools**
- **Content Processing**

## API Endpoints

### Admin Endpoints (Require Admin Access)

- `GET /api/admin/feature-pricing` - List all pricing
- `POST /api/admin/feature-pricing` - Create new pricing
- `GET /api/admin/feature-pricing/[id]` - Get single pricing
- `PATCH /api/admin/feature-pricing/[id]` - Update pricing
- `DELETE /api/admin/feature-pricing/[id]` - Delete pricing

### Public Endpoints

- `GET /api/features/pricing?key={featureKey}` - Get pricing by key

## Example Feature Keys

Here are some suggested feature keys for your platform:

```typescript
// Image Generation
'seedream_text_to_image'
'seedream_image_to_image'

// Video Generation
'seedream_text_to_video'
'seedream_image_to_video'
'kling_text_to_video'
'kling_image_to_video'
'kling_multi_image_to_video'
'kling_motion_control'

// AI Voice
'ai_voice_generation'

// Advanced Tools
'face_swap'
'skin_enhancer'
'fps_boost'
```

## Troubleshooting

### Credits not deducting
- Check that the feature key matches exactly
- Verify the pricing is set to `isActive: true`
- Check console for error messages

### "Feature pricing not found" error
- Ensure you've created the pricing in the admin panel
- Verify the feature key is spelled correctly
- Check that `isActive` is true

### Credits deducted but feature failed
- Implement proper error handling and credit refunds
- Log errors for debugging
- Consider implementing a transaction-like pattern
