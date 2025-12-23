# Profile-Based Likes System - Implementation Summary

## Problem
Likes were tied to user accounts instead of individual profiles. When a user liked a post from any profile (e.g., "sybau"), the like would show across ALL their profiles because it was checking `userId` instead of `profileId`.

## Solution
Changed the like system to be profile-based instead of user-based. Each profile can now independently like posts and comments.

## Changes Made

### 1. Database Schema Updates (`schema.prisma`)

#### FeedPostLike Model
- Added `profileId` field (required)
- Added relation to `InstagramProfile`
- Changed unique constraint from `[postId, userId]` to `[postId, profileId]`
- Added index on `profileId`

#### FeedPostCommentLike Model
- Added `profileId` field (required)
- Added relation to `InstagramProfile`
- Changed unique constraint from `[commentId, userId]` to `[commentId, profileId]`
- Added index on `profileId`

#### InstagramProfile Model
- Added `postLikes` relation (FeedPostLike[])
- Added `commentLikes` relation (FeedPostCommentLike[])

### 2. API Updates

#### `/api/feed/posts/[postId]/like/route.ts`
- **POST**: Now requires `profileId` in request body
- Validates profile belongs to current user
- Creates like with `profileId`
- Uses `postId_profileId` unique constraint

- **DELETE**: Now requires `profileId` in request body
- Deletes like using `postId_profileId` constraint

#### `/api/feed/comments/[commentId]/like/route.ts`
- **POST**: Now requires `profileId` in request body
- Validates profile belongs to current user
- Creates like with `profileId`

- **DELETE**: Now requires `profileId` in request body
- Deletes like using `profileId`

#### `/api/feed/posts/route.ts` (GET)
- Now accepts `profileId` query parameter
- Checks if posts are liked by the specified profile (not just user)

#### `/api/feed/posts/[postId]/comments/route.ts` (GET)
- Now accepts `profileId` query parameter
- Checks if comments are liked by the specified profile (not just user)

### 3. Frontend Updates

#### `FeedContent.tsx`
- `handleLike()` now sends `profileId` in request body
- Validates that a profile is selected before liking
- Shows error if no profile is selected

#### `CommentsModal.tsx`
- `loadComments()` now passes `profileId` as query parameter
- `handleLikeComment()` now sends `profileId` in request body
- Validates that a profile is selected before liking

## Database Migration

### Migration File
Created: `add-profile-to-likes-migration.sql`

### Migration Steps:
1. Add `profileId` column (nullable first)
2. Populate `profileId` for existing likes using user's default profile
3. Make `profileId` NOT NULL
4. Drop old unique constraints (`postId_userId`, `commentId_userId`)
5. Add new unique constraints (`postId_profileId`, `commentId_profileId`)
6. Add indexes on `profileId`
7. Add foreign key constraints

### Running the Migration

**Option 1: Using Prisma Migrate (when database is accessible)**
```bash
npx prisma migrate dev --name add_profile_id_to_likes
```

**Option 2: Manual SQL (if database is not accessible locally)**
```bash
# Connect to your database and run:
psql <your-connection-string> -f add-profile-to-likes-migration.sql
```

**Option 3: Run SQL directly in database client**
Copy the contents of `add-profile-to-likes-migration.sql` and execute in your database management tool.

### After Migration

1. Generate Prisma Client:
```bash
npx prisma generate
```

2. Test the changes:
- Select a profile in ProfilesSidebar
- Like a post
- Switch to a different profile
- Verify the post is NOT liked for the new profile
- Like the same post from the new profile
- Switch back to first profile and verify it's still liked

## How It Works Now

1. **Profile Selection**: User selects a profile from ProfilesSidebar
2. **Profile Context**: Selected `profileId` is stored in localStorage and passed via CustomEvent
3. **Liking Posts**: When user clicks like:
   - Frontend sends `profileId` to API
   - API validates profile belongs to user
   - Like is created/deleted with specific `profileId`
4. **Viewing Posts**: When loading posts:
   - Frontend passes selected `profileId` as query parameter
   - API checks if posts are liked by that specific profile
   - Each profile sees its own like status

## Benefits

- ✅ Each profile has independent likes
- ✅ Switching profiles shows correct like status
- ✅ Multiple profiles can like the same post independently
- ✅ Consistent with profile-based commenting system
- ✅ Better matches Instagram's multi-account behavior

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Generate Prisma client
- [ ] Select profile A and like a post
- [ ] Switch to profile B - post should NOT be liked
- [ ] Like the same post from profile B
- [ ] Switch back to profile A - post should still be liked
- [ ] Unlike from profile A
- [ ] Profile B's like should remain
- [ ] Test comment likes with same workflow
- [ ] Test across multiple posts and comments
