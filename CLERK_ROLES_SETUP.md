# Setting Up User Roles in Clerk

The Instagram Staging Tool now uses role-based access control with 4 role levels:

## Role Hierarchy

1. **ADMIN** - Full control (all permissions)
2. **MANAGER** - Content approval & management
3. **CONTENT_CREATOR** - Can create and submit posts only
4. **USER** - No access to staging tool (regular website users)

## How to Set User Roles in Clerk Dashboard

### Step 1: Access Clerk Dashboard
1. Go to [clerk.com](https://dashboard.clerk.com)
2. Select your application (`ai.tastycreative`)
3. Click on **Users** in the left sidebar

### Step 2: Set Role for a User
1. Click on a user from the user list
2. Scroll down to **Public metadata** section
3. Click **Edit**
4. Add this JSON:

```json
{
  "role": "MANAGER"
}
```

Replace `"MANAGER"` with one of:
- `"ADMIN"`
- `"MANAGER"`
- `"CONTENT_CREATOR"`
- `"USER"`

5. Click **Save**

### Step 3: Set Default Role for New Users

To automatically assign roles to new users when they sign up:

1. Go to **Configure** → **Sessions** in Clerk Dashboard
2. Under **Customize session token**, add:

```json
{
  "role": "{{user.public_metadata.role}}"
}
```

3. In your application, set default role on user creation (in webhook or signup flow):

```typescript
// When creating a new user, set default role
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    role: 'USER' // Default for new signups
  }
});
```

## Permission Matrix

| Action | ADMIN | MANAGER | CONTENT_CREATOR | USER |
|--------|-------|---------|-----------------|------|
| Access Tool | ✅ | ✅ | ✅ | ❌ |
| Create Posts | ✅ | ✅ | ✅ | ❌ |
| Submit for Review | ✅ | ✅ | ✅ | ❌ |
| Approve/Reject | ✅ | ✅ | ❌ | ❌ |
| Schedule Posts | ✅ | ✅ | ❌ | ❌ |
| Mark as Published | ✅ | ✅ | ❌ | ❌ |
| Delete Any Post | ✅ | ✅ | ❌ | ❌ |
| Edit All Posts | ✅ | ✅ | ❌ | ❌ |
| Edit Own Drafts | ✅ | ✅ | ✅ | ❌ |

## Content Workflow

```
1. DRAFT (Gray)
   ↓ Content Creator submits
   
2. REVIEW (Yellow)
   ↓ Manager/Admin approves
   
3. APPROVED (Green)
   ↓ Manager/Admin sets date & schedules
   
4. SCHEDULED (Purple)
   ↓ Manager/Admin posts to Instagram manually
   
5. PUBLISHED (Pink)
   ✓ Done!
```

## Quick Setup for Your Team

### Set up team members:

```bash
# Example team structure:

john@company.com     → role: "ADMIN"
jane@company.com     → role: "MANAGER"
sarah@company.com    → role: "CONTENT_CREATOR"
mark@company.com     → role: "CONTENT_CREATOR"
customer@email.com   → role: "USER" (default)
```

## Testing Roles

To test the system:

1. Create multiple Clerk accounts
2. Assign different roles via public metadata
3. Log in as each user to see different permissions
4. Try actions that should be restricted

## UI Indicators

- **Role Badge**: Shows in header (ADMIN/MANAGER/CONTENT_CREATOR)
- **Workflow Guide**: Expandable info panel showing permissions
- **Workflow Progress Bar**: Visual status indicator in post editor
- **Conditional Buttons**: Only show actions user can perform
- **Permission Alerts**: If user tries unauthorized action

## Need Help?

If you need to bulk update roles or automate role assignment:

1. Use Clerk's User Management API
2. Set up webhooks for automated role assignment
3. Create an admin panel for role management

Example API call:
```typescript
import { clerkClient } from '@clerk/nextjs';

await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    role: 'MANAGER'
  }
});
```
