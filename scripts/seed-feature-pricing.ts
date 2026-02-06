#!/usr/bin/env ts-node

import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding feature pricing...\n');

  const features = [
    // SeeDream 4.5 Features
    {
      featureKey: 'seedream_text_to_image',
      featureName: 'SeeDream Text to Image',
      category: 'Image Generation',
      credits: 10,
      description: 'Generate images from text prompts using SeeDream 4.5',
      isActive: true,
    },
    {
      featureKey: 'seedream_image_to_image',
      featureName: 'SeeDream Image to Image',
      category: 'Image Generation',
      credits: 15,
      description: 'Transform images using SeeDream 4.5 image-to-image',
      isActive: true,
    },
    {
      featureKey: 'seedream_text_to_video',
      featureName: 'SeeDream Text to Video',
      category: 'Video Generation',
      credits: 50,
      description: 'Generate videos from text prompts using SeeDream 4.5',
      isActive: true,
    },
    {
      featureKey: 'seedream_image_to_video',
      featureName: 'SeeDream Image to Video',
      category: 'Video Generation',
      credits: 60,
      description: 'Create videos from images using SeeDream 4.5',
      isActive: true,
    },

    // Kling AI Features
    {
      featureKey: 'kling_text_to_video',
      featureName: 'Kling Text to Video',
      category: 'Video Generation',
      credits: 75,
      description: 'Generate high-quality videos from text using Kling AI',
      isActive: true,
    },
    {
      featureKey: 'kling_image_to_video',
      featureName: 'Kling Image to Video',
      category: 'Video Generation',
      credits: 80,
      description: 'Transform images into videos with Kling AI',
      isActive: true,
    },
    {
      featureKey: 'kling_multi_image_to_video',
      featureName: 'Kling Multi-Image to Video',
      category: 'Video Generation',
      credits: 100,
      description: 'Create videos from multiple images using Kling AI',
      isActive: true,
    },
    {
      featureKey: 'kling_motion_control',
      featureName: 'Kling Motion Control',
      category: 'Video Generation',
      credits: 120,
      description: 'Advanced motion control for video generation with Kling AI',
      isActive: true,
    },

    // AI Voice Features
    {
      featureKey: 'ai_voice_generation',
      featureName: 'AI Voice Generation',
      category: 'AI Voice',
      credits: 25,
      description: 'Generate AI voices using ElevenLabs or other providers',
      isActive: true,
    },

    // Advanced Tools
    {
      featureKey: 'face_swap',
      featureName: 'Face Swapping',
      category: 'Advanced Tools',
      credits: 30,
      description: 'Swap faces in images using AI',
      isActive: true,
    },
    {
      featureKey: 'image_to_image_skin_enhancer',
      featureName: 'Image-to-Image Skin Enhancer',
      category: 'Advanced Tools',
      credits: 20,
      description: 'Enhance skin quality in images',
      isActive: true,
    },
    {
      featureKey: 'fps_boost',
      featureName: 'FPS Boost',
      category: 'Advanced Tools',
      credits: 40,
      description: 'Increase video frame rate with AI interpolation',
      isActive: true,
    },

    // Training Features
    {
      featureKey: 'train_lora',
      featureName: 'Train LoRA Model',
      category: 'Model Training',
      credits: 200,
      description: 'Train a custom LoRA model for personalized AI generation',
      isActive: true,
    },

    // Content Processing
    {
      featureKey: 'gif_maker',
      featureName: 'GIF Maker',
      category: 'Content Processing',
      credits: 5,
      description: 'Create GIFs from images or videos',
      isActive: true,
    },
  ];

  let created = 0;
  let updated = 0;

  for (const feature of features) {
    const existing = await prisma.featureCreditPricing.findUnique({
      where: { featureKey: feature.featureKey },
    });

    if (existing) {
      await prisma.featureCreditPricing.update({
        where: { featureKey: feature.featureKey },
        data: {
          featureName: feature.featureName,
          category: feature.category,
          credits: feature.credits,
          description: feature.description,
          isActive: feature.isActive,
        },
      });
      console.log(`📝 Updated: ${feature.featureName} (${feature.credits} credits)`);
      updated++;
    } else {
      await prisma.featureCreditPricing.create({
        data: feature,
      });
      console.log(`✨ Created: ${feature.featureName} (${feature.credits} credits)`);
      created++;
    }
  }

  console.log(`\n✅ Feature pricing seed completed!`);
  console.log(`   Created: ${created} features`);
  console.log(`   Updated: ${updated} features`);
  console.log(`   Total: ${features.length} features\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding feature pricing:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
