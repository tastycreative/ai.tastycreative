import { prisma } from "../lib/database";

const DEFAULT_CONTENT_TYPES = [
  "Fully Nude",
  "Dick Rating",
  "JOI",
  "Solo",
  "Squirting",
  "Anal",
  "Cream Pie",
  "BG",
  "BGG",
  "GG",
  "GGG",
  "BBG",
  "Orgy",
  "Livestream",
];

const DEFAULT_MESSAGE_TYPES = [
  "Mass DM",
  "Tip Me",
  "Renew",
  "Bundle Unlock",
  "Wall Post",
  "Wall Post Campaign",
  "PPV",
  "Welcome Message",
  "Expired Fan",
  "Sexting Script",
];

async function seedCaptionTypes() {
  console.log("🌱 Seeding caption types...");

  // Seed Content Types
  console.log("📦 Seeding Content Types...");
  for (const name of DEFAULT_CONTENT_TYPES) {
    try {
      const existing = await prisma.captionContentType.findUnique({
        where: { name },
      });

      if (!existing) {
        await prisma.captionContentType.create({
          data: { name },
        });
        console.log(`✅ Created content type: ${name}`);
      } else {
        console.log(`⏭️  Content type already exists: ${name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating content type ${name}:`, error);
    }
  }

  // Seed Message Types
  console.log("\n💬 Seeding Message Types...");
  for (const name of DEFAULT_MESSAGE_TYPES) {
    try {
      const existing = await prisma.captionMessageType.findUnique({
        where: { name },
      });

      if (!existing) {
        await prisma.captionMessageType.create({
          data: { name },
        });
        console.log(`✅ Created message type: ${name}`);
      } else {
        console.log(`⏭️  Message type already exists: ${name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating message type ${name}:`, error);
    }
  }

  console.log("\n✨ Seeding complete!");
}

seedCaptionTypes()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
