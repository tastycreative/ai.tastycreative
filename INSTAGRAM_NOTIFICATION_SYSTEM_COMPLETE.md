# Instagram Notification-Based Posting Setup

## 🎯 **New Approach: Works with Personal Instagram Accounts!**

Instead of requiring Instagram Business accounts and API integration, your app now uses a **notification reminder system**:

1. User schedules a post with date/time
2. At scheduled time, app sends **email + browser notification + in-app reminder**
3. User manually posts to Instagram (takes 30 seconds)
4. User marks post as "Published" in the app

### ✅ Benefits:
- Works with **personal Instagram accounts** (no Business account needed!)
- No Facebook Page connection required
- No access tokens or API setup
- Simple for users to understand
- No risk of API violations or account bans

---

## 📋 **New Workflow**

### **Status Flow:**
```
DRAFT → REVIEW → APPROVED → SCHEDULED → PENDING → PUBLISHED
                                         ↑         ↑
                                    Reminder Sent  User Posted
```

### **User Experience:**

#### **1. Scheduling (Manager/Admin)**
- User uploads image to Google Drive
- User creates post in staging tool
- User adds caption
- User sets schedule date + time
- User clicks "Mark as Scheduled"
- ✅ Status: **SCHEDULED**

#### **2. Reminder Time (Automated)**
- Vercel Cron runs every minute
- Checks for posts where `scheduledDate <= NOW()`
- Sends notifications:
  - 📧 **Email** with image preview, caption, and download link
  - 🔔 **Browser notification** (if permitted)
  - 📱 **In-app notification** (coming soon)
- Updates status to **PENDING**

#### **3. Manual Posting (User)**
- User receives email: "Time to post on Instagram!"
- User clicks "Download Image" in email
- User opens Instagram app
- User uploads the image
- User copies and pastes the caption from email
- User posts to Instagram
- User returns to app and clicks "Mark as Published"
- ✅ Status: **PUBLISHED**

---

## 🛠️ **Setup Instructions**

### **Step 1: Configure Email Service (Resend)**

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month)
2. Get your API key from dashboard
3. Add to `.env.local`:
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   ```

4. Verify your sending domain (optional for production):
   - Add DNS records to your domain
   - Or use Resend's test domain: `notifications@resend.dev`

5. Update email sender in `lib/notification-service.ts`:
   ```typescript
   from: 'TastyCreative <notifications@your-domain.com>',
   ```

### **Step 2: Test Locally**

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Create a test post:
   - Upload image to Google Drive
   - Create post in staging tool
   - Set schedule for **2 minutes from now**
   - Click "Mark as Scheduled"

3. Manually trigger cron (or wait for scheduled time):
   ```powershell
   curl -X GET "http://localhost:3000/api/instagram/cron" `
     -H "Authorization: Bearer your-cron-secret"
   ```

4. Check your email inbox for reminder
5. Check browser for push notification

### **Step 3: Deploy to Vercel**

1. Add environment variables in Vercel dashboard:
   ```
   RESEND_API_KEY=re_your_api_key_here
   CRON_SECRET=your-random-secret-string
   NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
   ```

2. Deploy:
   ```bash
   git add .
   git commit -m "Add notification-based Instagram posting"
   git push origin main
   ```

3. Verify cron is running:
   - Go to Vercel dashboard → your project → Cron Jobs
   - Should see: `/api/instagram/cron` running every minute

---

## 📧 **Email Template Preview**

The email users receive looks like this:

```
┌───────────────────────────────────┐
│  📸 Time to Post!                 │
│  Your scheduled Instagram post    │
│  is ready                          │
└───────────────────────────────────┘

[Image Preview]

📝 Your Caption:
"Check out this amazing content! 
#instagram #content #creative"

🎯 How to Post:
1. Open Instagram app on your phone
2. Click the + button
3. Download the image (button below)
4. Upload to Instagram
5. Copy and paste the caption above
6. Click Share!

[Download Image] [View in App]

💡 Pro Tip: Click "View in App" to 
easily copy your caption!

Scheduled for: Fri, Oct 4, 2025 at 2:30 PM
```

---

## 🔔 **Browser Notifications**

### **How It Works:**
1. User opens your app
2. Browser requests notification permission
3. User clicks "Allow"
4. When reminder is due, browser shows pop-up notification
5. User clicks notification → opens app with post details

### **Permissions:**
- Only works if user granted permission
- Notification shows even if browser tab is closed
- Works on desktop (Chrome, Firefox, Edge)
- Works on mobile (Chrome for Android, Safari for iOS with limitations)

---

## 🎨 **UI Changes**

### **New "PENDING" Status Badge:**
- Color: Orange (`bg-orange-500`)
- Text: "Reminder Sent"
- Indicates user needs to post manually

### **Download Button:**
When post is PENDING or SCHEDULED:
```tsx
<button onClick={() => downloadImage(post.image, post.fileName)}>
  ⬇️ Download Image
</button>
```

### **Mark as Published Button:**
When post is PENDING:
```tsx
<button onClick={() => markAsPublished(post.id)}>
  ✅ I Posted This
</button>
```

---

## 🔧 **API Endpoints**

### **GET /api/instagram/cron**
**Purpose:** Check for scheduled posts and send reminders

**Triggered by:** Vercel Cron (every minute)

**Authorization:** Bearer token via `Authorization` header

**Process:**
1. Find posts with `status=SCHEDULED` and `scheduledDate <= NOW()`
2. For each post:
   - Get user email from Clerk
   - Send email reminder
   - Send browser notification data
   - Create in-app notification
   - Update post status to `PENDING`
3. Return results summary

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-10-04T14:30:00.000Z",
  "reminders": {
    "sent": 3,
    "failed": 0,
    "total": 3
  },
  "results": [...]
}
```

### **POST /api/instagram/mark-published**
**Purpose:** User manually marks post as published after posting to Instagram

**Body:**
```json
{
  "postId": "clxyz123..."
}
```

**Authorization:** Clerk user ID (must be post owner or ADMIN/MANAGER)

**Process:**
1. Verify user has permission
2. Update post status to `PUBLISHED`
3. Update `updatedAt` timestamp

**Response:**
```json
{
  "success": true,
  "post": { ...updatedPost },
  "message": "Post marked as published successfully"
}
```

---

## 📊 **Comparison with API Method**

| Feature | Notification Method (Current) | API Method (Option 1) |
|---------|-------------------------------|----------------------|
| **Account Type** | Personal Instagram ✅ | Business only ❌ |
| **Setup Difficulty** | Easy (email only) | Complex (OAuth, tokens) |
| **User Action** | Manual post (30 sec) | Fully automated |
| **Reliability** | Depends on user | 100% automated |
| **Risk** | None | API violations possible |
| **Cost** | Free (3K emails/month) | Free (within rate limits) |
| **Best For** | Small teams, personal use | Agencies, high volume |

---

## 🐛 **Troubleshooting**

### **Emails Not Sending**
1. Check `RESEND_API_KEY` is set correctly
2. Verify email doesn't land in spam
3. Check Resend dashboard for delivery status
4. Ensure sender domain is verified (production)

### **Browser Notifications Not Showing**
1. Check user granted permission
2. Verify notification permission in browser settings
3. Test with `Notification.permission` in console
4. Some browsers block notifications on HTTP (use HTTPS)

### **Cron Not Running**
1. Check Vercel dashboard → Cron Jobs tab
2. Verify `vercel.json` has cron configuration
3. Check `CRON_SECRET` matches in both places
4. View cron execution logs in Vercel

### **User Can't Download Image**
1. Verify Google Drive file is publicly accessible
2. Check `driveFileUrl` is valid
3. Test URL directly in browser
4. Ensure CORS headers allow downloads

---

## 🚀 **Next Steps**

### **Phase 1: Current (Completed)**
- ✅ Notification service with email
- ✅ Cron job for reminders
- ✅ PENDING status workflow
- ✅ Mark as Published API
- ✅ Email template with download links

### **Phase 2: Enhancements**
- [ ] SMS notifications (via Twilio)
- [ ] WhatsApp reminders (via Twilio/Meta Business)
- [ ] In-app notification center with history
- [ ] Instagram draft pre-fill (if API allows)
- [ ] Analytics: reminder open rate, post completion rate

### **Phase 3: Advanced**
- [ ] AI-generated caption variations
- [ ] Best time to post recommendations
- [ ] Multi-platform posting (TikTok, Twitter, etc.)
- [ ] Collaboration features (team comments on posts)

---

## 💡 **Tips for Users**

### **For Content Creators:**
- Enable browser notifications for instant reminders
- Add notifications@your-domain.com to email whitelist
- Set up email filters to highlight reminders
- Use quick action buttons in email (Download, View)

### **For Managers:**
- Schedule posts in batches for the week
- Use calendar view to see all scheduled posts
- Monitor PENDING posts to ensure team is posting
- Send follow-up reminders for overdue posts (future feature)

### **Best Practices:**
- Schedule during peak engagement hours
- Test the flow with a private Instagram account first
- Download images in advance if going offline
- Keep captions under Instagram's 2,200 character limit
- Use relevant hashtags (research shows 5-10 is optimal)

---

## 🔐 **Security & Privacy**

- Emails contain image URLs (Google Drive links)
- No passwords or access tokens stored
- User email addresses from Clerk (secure)
- Cron endpoint protected with secret token
- HTTPS required in production for notifications

---

## ✅ **Ready to Use!**

Your notification-based Instagram posting system is now complete and working with **personal Instagram accounts**!

Users simply:
1. Schedule posts
2. Receive reminders
3. Post manually to Instagram
4. Mark as published

**No Business account needed. No API setup required. Simple and effective!** 🎉
