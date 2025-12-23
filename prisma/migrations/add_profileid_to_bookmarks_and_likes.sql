-- Add profileId to FeedPostBookmark
ALTER TABLE feed_post_bookmarks 
ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- Add profileId to FeedPostLike
ALTER TABLE feed_post_likes 
ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- Add profileId to FeedPostCommentLike
ALTER TABLE feed_post_comment_likes 
ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- Update existing bookmarks to use the user's first profile (if any)
UPDATE feed_post_bookmarks fpb
SET "profileId" = (
  SELECT id 
  FROM instagram_profiles ip 
  WHERE ip."clerkId" = (SELECT "clerkId" FROM users WHERE id = fpb."userId")
  LIMIT 1
)
WHERE "profileId" IS NULL;

-- Update existing likes to use the user's first profile (if any)
UPDATE feed_post_likes fpl
SET "profileId" = (
  SELECT id 
  FROM instagram_profiles ip 
  WHERE ip."clerkId" = (SELECT "clerkId" FROM users WHERE id = fpl."userId")
  LIMIT 1
)
WHERE "profileId" IS NULL;

-- Update existing comment likes to use the user's first profile (if any)
UPDATE feed_post_comment_likes fpcl
SET "profileId" = (
  SELECT id 
  FROM instagram_profiles ip 
  WHERE ip."clerkId" = (SELECT "clerkId" FROM users WHERE id = fpcl."userId")
  LIMIT 1
)
WHERE "profileId" IS NULL;

-- Make profileId NOT NULL after updating existing records
ALTER TABLE feed_post_bookmarks 
ALTER COLUMN "profileId" SET NOT NULL;

ALTER TABLE feed_post_likes 
ALTER COLUMN "profileId" SET NOT NULL;

ALTER TABLE feed_post_comment_likes 
ALTER COLUMN "profileId" SET NOT NULL;

-- Drop old unique constraints
ALTER TABLE feed_post_bookmarks 
DROP CONSTRAINT IF EXISTS feed_post_bookmarks_postId_userId_key;

ALTER TABLE feed_post_likes 
DROP CONSTRAINT IF EXISTS feed_post_likes_postId_userId_key;

ALTER TABLE feed_post_comment_likes 
DROP CONSTRAINT IF EXISTS feed_post_comment_likes_commentId_userId_key;

-- Add new unique constraints with profileId
ALTER TABLE feed_post_bookmarks 
ADD CONSTRAINT feed_post_bookmarks_postId_profileId_key 
UNIQUE ("postId", "profileId");

ALTER TABLE feed_post_likes 
ADD CONSTRAINT feed_post_likes_postId_profileId_key 
UNIQUE ("postId", "profileId");

ALTER TABLE feed_post_comment_likes 
ADD CONSTRAINT feed_post_comment_likes_commentId_profileId_key 
UNIQUE ("commentId", "profileId");

-- Add foreign key constraints for profileId
ALTER TABLE feed_post_bookmarks 
ADD CONSTRAINT feed_post_bookmarks_profileId_fkey 
FOREIGN KEY ("profileId") REFERENCES instagram_profiles(id) ON DELETE CASCADE;

ALTER TABLE feed_post_likes 
ADD CONSTRAINT feed_post_likes_profileId_fkey 
FOREIGN KEY ("profileId") REFERENCES instagram_profiles(id) ON DELETE CASCADE;

ALTER TABLE feed_post_comment_likes 
ADD CONSTRAINT feed_post_comment_likes_profileId_fkey 
FOREIGN KEY ("profileId") REFERENCES instagram_profiles(id) ON DELETE CASCADE;

-- Add indexes for profileId
CREATE INDEX IF NOT EXISTS feed_post_bookmarks_profileId_idx ON feed_post_bookmarks("profileId");
CREATE INDEX IF NOT EXISTS feed_post_likes_profileId_idx ON feed_post_likes("profileId");
CREATE INDEX IF NOT EXISTS feed_post_comment_likes_profileId_idx ON feed_post_comment_likes("profileId");
