/**
 * Seed file for the Spaces feature.
 *
 * Run with:  npx tsx prisma/seed-templates.ts
 *
 * Creates a "test-kanban" workspace under the given organization,
 * with a default board, columns, sample items, and comments.
 *
 * Edit the ORGANIZATION_ID constant and template configs below to
 * adjust the seed data before running.
 */

import { PrismaClient } from '../lib/generated/prisma';
import {
  KANBAN_METADATA_DEFAULTS,
  WALL_POST_METADATA_DEFAULTS,
  SEXTING_SETS_METADATA_DEFAULTS,
  OTP_PTR_METADATA_DEFAULTS,
} from '../lib/spaces/template-metadata';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  CONFIG — change these to match your environment                    */
/* ------------------------------------------------------------------ */

const ORGANIZATION_ID = 'cmksqmzkt0002ordgqtd8us40';

/* ------------------------------------------------------------------ */
/*  Template config shapes (stored in Workspace.config as JSON)        */
/* ------------------------------------------------------------------ */

export interface ColumnSeed {
  name: string;
  color: string;
  position: number;
}

export interface WorkTypeSeed {
  name: string;
  icon: string;
  description: string;
}

export interface SpaceConfigSeed {
  defaultColumns: ColumnSeed[];
  workTypes: WorkTypeSeed[];
  itemFields: string[];
  features: Record<string, boolean>;
}

export interface TemplateSeed {
  templateType: 'KANBAN' | 'WALL_POST' | 'SEXTING_SETS' | 'OTP_PTR';
  name: string;
  slug: string;
  key: string;
  description: string;
  config: SpaceConfigSeed;
}

/* ------------------------------------------------------------------ */
/*  Template definitions                                               */
/* ------------------------------------------------------------------ */

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    templateType: 'KANBAN',
    name: 'Test Kanban',
    slug: 'test-kanban',
    key: 'KB',
    description: 'General-purpose Kanban board for project management.',
    config: {
      defaultColumns: [
        { name: 'To Do', color: 'blue', position: 0 },
        { name: 'In Progress', color: 'amber', position: 1 },
        { name: 'Done', color: 'green', position: 2 },
      ],
      workTypes: [
        { name: 'Planning', icon: 'target', description: 'Plan sprints, set goals, and define project scope' },
        { name: 'Content', icon: 'file', description: 'Create and manage content deliverables' },
        { name: 'Workflow', icon: 'zap', description: 'Track processes and standard operating procedures' },
        { name: 'Review', icon: 'message', description: 'Quality assurance and review cycles' },
        { name: 'Design', icon: 'palette', description: 'Visual design and creative asset production' },
      ],
      itemFields: ['title', 'description', 'priority', 'assigneeId', 'dueDate', 'metadata'],
      features: {
        dragAndDrop: true,
        subtasks: true,
        timeTracking: false,
        comments: true,
        mediaAttachments: true,
      },
    },
  },
  {
    templateType: 'WALL_POST',
    name: 'Wall Posts',
    slug: 'wall-posts',
    key: 'WP',
    description: 'Manage social media wall posts from draft to published.',
    config: {
      defaultColumns: [
        { name: 'Draft', color: 'blue', position: 0 },
        { name: 'Review', color: 'amber', position: 1 },
        { name: 'Approved', color: 'green', position: 2 },
        { name: 'Scheduled', color: 'purple', position: 3 },
        { name: 'Published', color: 'pink', position: 4 },
      ],
      workTypes: [
        { name: 'Wall Post', icon: 'image', description: 'Create wall post content for social platforms' },
        { name: 'Story', icon: 'layout', description: 'Create story-format content' },
        { name: 'Carousel', icon: 'layout', description: 'Multi-image carousel posts' },
      ],
      itemFields: ['title', 'description', 'priority', 'assigneeId', 'dueDate', 'metadata'],
      features: {
        dragAndDrop: true,
        mediaUpload: true,
        scheduling: true,
        captionEditor: true,
        hashtagSuggestion: true,
        comments: true,
      },
    },
  },
  {
    templateType: 'SEXTING_SETS',
    name: 'Sexting Sets',
    slug: 'sexting-sets',
    key: 'SS',
    description: 'Organize and track sexting set production workflows.',
    config: {
      defaultColumns: [
        { name: 'Concept', color: 'purple', position: 0 },
        { name: 'Shooting', color: 'amber', position: 1 },
        { name: 'Editing', color: 'blue', position: 2 },
        { name: 'Ready', color: 'green', position: 3 },
        { name: 'Distributed', color: 'pink', position: 4 },
      ],
      workTypes: [
        { name: 'Photo Set', icon: 'image', description: 'Photo-based sexting sets' },
        { name: 'Video Clip', icon: 'layout', description: 'Short video clips for sets' },
        { name: 'Bundle', icon: 'briefcase', description: 'Bundled multi-format sets' },
      ],
      itemFields: ['title', 'description', 'priority', 'assigneeId', 'dueDate', 'metadata'],
      features: {
        dragAndDrop: true,
        mediaUpload: true,
        bulkUpload: true,
        setManagement: true,
        comments: true,
        categoryFilter: true,
      },
    },
  },
  {
    templateType: 'OTP_PTR',
    name: 'OTP/PTR Requests',
    slug: 'otp-ptr-requests',
    key: 'OP',
    description: 'Handle OTP and PTR request workflows efficiently.',
    config: {
      defaultColumns: [
        { name: 'Incoming', color: 'blue', position: 0 },
        { name: 'In Production', color: 'amber', position: 1 },
        { name: 'Delivered', color: 'green', position: 2 },
        { name: 'Completed', color: 'purple', position: 3 },
      ],
      workTypes: [
        { name: 'OTP Request', icon: 'zap', description: 'One-time purchase content requests' },
        { name: 'PTR Request', icon: 'briefcase', description: 'Pay-to-receive fulfillment requests' },
        { name: 'Custom Request', icon: 'megaphone', description: 'Custom content commissions' },
      ],
      itemFields: ['title', 'description', 'priority', 'assigneeId', 'dueDate', 'metadata'],
      features: {
        dragAndDrop: true,
        pricing: true,
        fulfillmentTracking: true,
        buyerInfo: true,
        deadlineAlerts: true,
        comments: true,
        mediaAttachments: true,
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Helper: get config for a template type                             */
/* ------------------------------------------------------------------ */

export function getTemplateConfig(
  templateType: TemplateSeed['templateType'],
): SpaceConfigSeed {
  const tpl = TEMPLATE_SEEDS.find((t) => t.templateType === templateType);
  if (!tpl) throw new Error(`Unknown template type: ${templateType}`);
  return tpl.config;
}

export function getTemplateColumns(
  templateType: TemplateSeed['templateType'],
): ColumnSeed[] {
  return getTemplateConfig(templateType).defaultColumns;
}

/* ------------------------------------------------------------------ */
/*  Metadata per template (imported from lib/spaces/template-metadata) */
/*                                                                     */
/*  The defaults come from the shared lib. Sample items below override */
/*  individual fields to create realistic seed data.                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Seed runner                                                        */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('Starting seed...\n');

  // Verify the organization exists
  const org = await prisma.organization.findUnique({
    where: { id: ORGANIZATION_ID },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    console.error(`Organization ${ORGANIZATION_ID} not found. Update the ORGANIZATION_ID constant.`);
    process.exit(1);
  }

  console.log(`Organization found: "${org.name}" (${org.slug})\n`);

  // Seed each template as a workspace
  for (const tpl of TEMPLATE_SEEDS) {
    console.log(`── Seeding: ${tpl.name} (${tpl.templateType}) ──`);

    // Skip if a workspace with this slug already exists for this org
    const existing = await prisma.workspace.findFirst({
      where: { organizationId: ORGANIZATION_ID, slug: tpl.slug },
      select: { id: true },
    });

    if (existing) {
      console.log(`  ⏭  Workspace "${tpl.slug}" already exists, skipping.\n`);
      continue;
    }

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        organizationId: ORGANIZATION_ID,
        name: tpl.name,
        slug: tpl.slug,
        description: tpl.description,
        templateType: tpl.templateType as any,
        key: tpl.key,
        access: 'OPEN',
        config: tpl.config as any,
        color: 'brand-light-pink',
        icon: tpl.templateType,
      },
    });

    console.log(`  ✓ Workspace created: ${workspace.id}`);

    // Create a default board
    const board = await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        name: 'Main Board',
        description: `Default board for ${tpl.name}`,
        position: 0,
      },
    });

    console.log(`  ✓ Board created: ${board.id}`);

    // Create columns from template config
    const columnIds: Record<string, string> = {};
    for (const col of tpl.config.defaultColumns) {
      const created = await prisma.boardColumn.create({
        data: {
          boardId: board.id,
          name: col.name,
          color: col.color,
          position: col.position,
        },
      });
      columnIds[col.name] = created.id;
      console.log(`  ✓ Column: "${col.name}" (${col.color})`);
    }

    // Pick sample items based on template
    const sampleItems = getSampleItems(tpl.templateType, columnIds);

    for (const item of sampleItems) {
      const created = await prisma.boardItem.create({
        data: {
          columnId: item.columnId,
          title: item.title,
          description: item.description ?? null,
          type: item.type as any,
          priority: item.priority as any,
          assigneeId: item.assigneeId ?? null,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          position: item.position,
          metadata: (item.metadata as any) ?? undefined,
          createdBy: item.createdBy ?? null,
        },
      });

      // Add a sample comment to the first item
      if (item.position === 0) {
        await prisma.boardItemComment.create({
          data: {
            itemId: created.id,
            content: `This is a sample comment on "${created.title}". You can edit or delete it.`,
            createdBy: 'system-seed',
          },
        });
        console.log(`  ✓ Item + comment: "${created.title}"`);
      } else {
        console.log(`  ✓ Item: "${created.title}"`);
      }
    }

    console.log('');
  }

  console.log('Seed complete!');
}

/* ------------------------------------------------------------------ */
/*  Sample items per template type                                     */
/* ------------------------------------------------------------------ */

interface SampleItem {
  columnId: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  assigneeId?: string;
  dueDate?: string;
  position: number;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

function getSampleItems(
  templateType: string,
  columnIds: Record<string, string>,
): SampleItem[] {
  switch (templateType) {
    case 'KANBAN':
      return [
        {
          columnId: columnIds['To Do'],
          title: 'Set up project repository',
          description: 'Initialize the repo with proper folder structure and README.',
          type: 'TASK',
          priority: 'HIGH',
          position: 0,
          dueDate: '2026-03-01',
          metadata: { ...KANBAN_METADATA_DEFAULTS, tags: ['setup', 'sprint-1'], storyPoints: 3, labels: ['setup', 'infra'] },
        },
        {
          columnId: columnIds['To Do'],
          title: 'Design homepage wireframe',
          description: 'Create low-fidelity wireframes for the main landing page.',
          type: 'TASK',
          priority: 'MEDIUM',
          position: 1,
          metadata: { ...KANBAN_METADATA_DEFAULTS, tags: ['design'], storyPoints: 5, labels: ['design'] },
        },
        {
          columnId: columnIds['In Progress'],
          title: 'Build authentication flow',
          description: 'Implement login, signup, and password reset with Clerk.',
          type: 'TASK',
          priority: 'URGENT',
          position: 0,
          dueDate: '2026-02-25',
          metadata: { ...KANBAN_METADATA_DEFAULTS, tags: ['backend'], storyPoints: 8, labels: ['backend', 'auth'] },
        },
        {
          columnId: columnIds['Done'],
          title: 'Configure CI/CD pipeline',
          description: 'Set up GitHub Actions for automated testing and deployment.',
          type: 'TASK',
          priority: 'LOW',
          position: 0,
          metadata: { ...KANBAN_METADATA_DEFAULTS, tags: ['devops'], storyPoints: 2, labels: ['devops'] },
        },
      ];

    case 'WALL_POST':
      return [
        {
          columnId: columnIds['Draft'],
          title: 'Beach photoshoot post',
          description: 'Summer beach set — 5 images, lifestyle aesthetic.',
          type: 'POST',
          priority: 'HIGH',
          position: 0,
          metadata: { ...WALL_POST_METADATA_DEFAULTS, caption: 'Beach day vibes ☀️', mediaCount: 5 },
        },
        {
          columnId: columnIds['Review'],
          title: 'BTS studio session',
          description: 'Behind-the-scenes content from last week\'s studio session.',
          type: 'POST',
          priority: 'MEDIUM',
          position: 0,
          metadata: { ...WALL_POST_METADATA_DEFAULTS, caption: 'Studio magic ✨', platform: 'onlyfans', mediaCount: 3 },
        },
        {
          columnId: columnIds['Approved'],
          title: 'New outfit reveal',
          description: 'Carousel post showing new outfit from multiple angles.',
          type: 'POST',
          priority: 'MEDIUM',
          position: 0,
          metadata: { ...WALL_POST_METADATA_DEFAULTS, caption: 'New fit just dropped 🔥', hashtags: ['ootd', 'fashion'] },
        },
        {
          columnId: columnIds['Scheduled'],
          title: 'Valentine\'s promo post',
          description: 'Scheduled Valentine\'s Day promotion — auto-publish.',
          type: 'POST',
          priority: 'HIGH',
          position: 0,
          dueDate: '2026-02-14',
          metadata: { ...WALL_POST_METADATA_DEFAULTS, scheduledDate: '2026-02-14T10:00:00Z' },
        },
      ];

    case 'SEXTING_SETS':
      return [
        {
          columnId: columnIds['Concept'],
          title: 'Bedroom lingerie set',
          description: '12-image set, soft lighting, intimate setting.',
          type: 'SET',
          priority: 'HIGH',
          position: 0,
          metadata: { ...SEXTING_SETS_METADATA_DEFAULTS, category: 'bedroom', setSize: 12 },
        },
        {
          columnId: columnIds['Shooting'],
          title: 'Pool day summer set',
          description: 'Outdoor pool shoot, 8 images + 2 short clips.',
          type: 'SET',
          priority: 'MEDIUM',
          position: 0,
          metadata: { ...SEXTING_SETS_METADATA_DEFAULTS, category: 'outdoor', setSize: 10, quality: '4K' },
        },
        {
          columnId: columnIds['Ready'],
          title: 'Mirror selfie series',
          description: 'Quick-turnaround selfie set, 6 images.',
          type: 'SET',
          priority: 'LOW',
          position: 0,
          metadata: { ...SEXTING_SETS_METADATA_DEFAULTS, category: 'selfie', setSize: 6, watermarked: true },
        },
      ];

    case 'OTP_PTR':
      return [
        {
          columnId: columnIds['Incoming'],
          title: 'Custom video request — @fan123',
          description: 'Requested a 2-minute custom video with specific outfit.',
          type: 'REQUEST',
          priority: 'HIGH',
          position: 0,
          dueDate: '2026-03-05',
          metadata: { ...OTP_PTR_METADATA_DEFAULTS, buyer: '@fan123', price: 50.0, deliverables: ['1 custom video (2 min)'] },
        },
        {
          columnId: columnIds['In Production'],
          title: 'Photo bundle — @vipuser',
          description: '5 exclusive photos, already paid.',
          type: 'REQUEST',
          priority: 'MEDIUM',
          position: 0,
          metadata: { ...OTP_PTR_METADATA_DEFAULTS, buyer: '@vipuser', price: 35.0, deliverables: ['5 photos'], isPaid: true },
        },
        {
          columnId: columnIds['Delivered'],
          title: 'Voice note — @subscriber99',
          description: 'Personalized voice note, delivered via DM.',
          type: 'REQUEST',
          priority: 'LOW',
          position: 0,
          metadata: { ...OTP_PTR_METADATA_DEFAULTS, requestType: 'PTR', buyer: '@subscriber99', price: 15.0, isPaid: true },
        },
        {
          columnId: columnIds['Completed'],
          title: 'GFE package — @loyalfan',
          description: 'Girlfriend-experience message bundle, completed and reviewed.',
          type: 'REQUEST',
          priority: 'MEDIUM',
          position: 0,
          metadata: { ...OTP_PTR_METADATA_DEFAULTS, requestType: 'OTP', buyer: '@loyalfan', price: 75.0, isPaid: true },
        },
      ];

    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Run                                                                */
/* ------------------------------------------------------------------ */

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
