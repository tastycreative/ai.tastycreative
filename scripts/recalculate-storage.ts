/**
 * Script to recalculate storage for all organizations
 * Run this once to populate currentStorageGB for existing organizations
 *
 * Usage:
 *   npx tsx scripts/recalculate-storage.ts
 *
 * Or for a specific organization:
 *   npx tsx scripts/recalculate-storage.ts --org=clorg_abc123
 */

import { recalculateAllOrganizationStorage, updateOrganizationStorageUsage } from '../lib/storageTracking';
import { prisma } from '../lib/database';

async function main() {
  const args = process.argv.slice(2);
  const orgArg = args.find(arg => arg.startsWith('--org='));

  if (orgArg) {
    // Recalculate for specific organization
    const orgId = orgArg.split('=')[1];
    console.log(`🔄 Recalculating storage for organization: ${orgId}\n`);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      console.error(`❌ Organization not found: ${orgId}`);
      process.exit(1);
    }

    console.log(`📊 Organization: ${org.name} (${org.id})`);

    const storageGB = await updateOrganizationStorageUsage(orgId);

    console.log(`\n✅ Storage calculation complete:`);
    console.log(`   Total Storage: ${storageGB} GB`);

  } else {
    // Recalculate for all organizations
    console.log(`🔄 Recalculating storage for ALL organizations\n`);
    console.log(`This may take a while...\n`);

    await recalculateAllOrganizationStorage();

    console.log(`\n✅ All organizations storage recalculated successfully!`);
  }

  // Show summary
  console.log(`\n📊 Storage Summary:\n`);

  const organizations = await prisma.organization.findMany({
    include: {
      subscriptionPlan: true,
    },
    orderBy: {
      currentStorageGB: 'desc',
    },
  });

  console.log('┌─────────────────────────────────┬──────────────┬──────────────┬───────────┐');
  console.log('│ Organization                    │ Storage (GB) │ Limit (GB)   │ Usage %   │');
  console.log('├─────────────────────────────────┼──────────────┼──────────────┼───────────┤');

  for (const org of organizations) {
    const maxGB = org.customMaxStorageGB ?? org.subscriptionPlan?.maxStorageGB ?? 5;
    const percentage = (org.currentStorageGB / maxGB) * 100;
    const usageIndicator = percentage > 90 ? '🔴' : percentage > 70 ? '🟡' : '🟢';

    console.log(
      `│ ${org.name.padEnd(31)} │ ${org.currentStorageGB.toFixed(2).padStart(12)} │ ${maxGB.toString().padStart(12)} │ ${usageIndicator} ${percentage.toFixed(1).padStart(6)}% │`
    );
  }

  console.log('└─────────────────────────────────┴──────────────┴──────────────┴───────────┘');

  const totalStorage = organizations.reduce((sum, org) => sum + org.currentStorageGB, 0);
  console.log(`\n📦 Total Storage Across All Organizations: ${totalStorage.toFixed(2)} GB\n`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
