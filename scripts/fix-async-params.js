const fs = require('fs');
const path = require('path');

// Files that need to be fixed
const filesToFix = [
  'app/api/instagram/profiles/[id]/upload-image/route.ts',
  'app/api/vault/folders/[id]/route.ts',
  'app/api/vault/items/[id]/route.ts',
  'app/api/instagram/profiles/[id]/default/route.ts',
  'app/api/instagram/profiles/[id]/route.ts',
  'app/api/friends/request/[requestId]/accept/route.ts',
  'app/api/friends/request/[requestId]/cancel/route.ts',
  'app/api/friends/request/[requestId]/reject/route.ts',
  'app/api/feed/posts/[postId]/bookmark/route.ts',
  'app/api/feed/posts/[postId]/comments/route.ts',
  'app/api/feed/posts/[postId]/like/route.ts',
  'app/api/feed/comments/[commentId]/like/route.ts',
  'app/api/webhooks/generation/[jobId]/route.ts',
  'app/api/videos/[videoId]/route.ts',
  'app/api/videos/s3/[key]/route.ts',
  'app/api/videos/[videoId]/data/route.ts',
  'app/api/user/influencers/[id]/generated-images/route.ts',
  'app/api/user/influencers/[id]/route_fixed.ts',
  'app/api/user/influencers/[id]/route.ts',
  'app/api/user/influencers/[id]/thumbnail/route.ts',
  'app/api/media/s3/[key]/route.ts',
  'app/api/jobs/sync-runpod/[jobId]/route.ts',
  'app/api/jobs/[jobId]/route.ts',
  'app/api/jobs/[jobId]/runpod-status/route.ts',
  'app/api/jobs/[jobId]/status/route.ts',
  'app/api/jobs/[jobId]/videos/route.ts',
  'app/api/jobs/[jobId]/cancel/route.ts',
  'app/api/jobs/[jobId]/force-save-images/route.ts',
  'app/api/jobs/[jobId]/images/route.ts',
  'app/api/instagram/posts/[id]/route.ts',
  'app/api/instagram-posts/[id]/route.ts',
  'app/api/images/s3/[key]/route.ts',
  'app/api/images/temp/[filename]/route.ts',
  'app/api/images/[imageId]/data/route.ts',
  'app/api/images/[imageId]/network-volume/route.ts',
  'app/api/images/[imageId]/route.ts',
  'app/api/friends/[friendshipId]/route.ts',
  'app/api/feed/profile/[userId]/posts/route.ts',
  'app/api/feed/profile/[userId]/route.ts',
  'app/api/feed/posts/[postId]/comments/[commentId]/route.ts',
  'app/api/feed/posts/[postId]/route.ts',
  'app/api/debug/job-images/[jobId]/route.ts',
  'app/api/debug/db-check/[jobId]/route.ts',
  'app/api/admin/users/[id]/route.ts',
  'app/api/admin/production-entries/[id]/route.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Pattern 1: async function VERB(request: NextRequest, { params }: { params: { ... } })
  // Replace with: async function VERB(request: NextRequest, props: { params: Promise<{ ... }> })
  const pattern1 = /async function (GET|POST|PUT|PATCH|DELETE)\s*\(\s*request:\s*NextRequest\s*,\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  if (pattern1.test(content)) {
    content = content.replace(
      /async function (GET|POST|PUT|PATCH|DELETE)\s*\(\s*request:\s*NextRequest\s*,\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      'async function $1(\n  request: NextRequest,\n  props: { params: Promise<{$2}> }'
    );
    modified = true;
  }

  // Pattern 2: For handlers without NextRequest (just params)
  // async function VERB({ params }: { params: { ... } })
  const pattern2 = /async function (GET|POST|PUT|PATCH|DELETE)\s*\(\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  if (pattern2.test(content)) {
    content = content.replace(
      /async function (GET|POST|PUT|PATCH|DELETE)\s*\(\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      'async function $1(props: { params: Promise<{$2}> }'
    );
    modified = true;
  }

  // Now add await params at the beginning of each handler function
  // Find the function body and add const params = await props.params;
  content = content.replace(
    /(async function (?:GET|POST|PUT|PATCH|DELETE)\s*\([^)]*props: \{ params: Promise<[^>]+>\s*\}\s*\)\s*\{)/g,
    '$1\n  const params = await props.params;'
  );

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed for ${filePath}`);
  }
}

console.log('🔧 Fixing async params in route handlers...\n');
filesToFix.forEach(fixFile);
console.log('\n✨ Done!');
