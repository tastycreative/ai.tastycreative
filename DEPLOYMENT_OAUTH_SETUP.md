# OAuth Setup for Production Deployment

## Google OAuth Configuration

When you deploy your application to production (e.g., Vercel, Netlify, etc.), you need to update your Google OAuth settings with the production URLs.

### Step 1: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID

### Step 2: Add Production URLs

#### Authorized JavaScript Origins
Add your production domain(s):
```
https://your-production-domain.com
https://www.your-production-domain.com
```

**Keep localhost for development:**
```
http://localhost:3000
http://localhost:3001
```

#### Authorized Redirect URIs
Add your production callback URL(s):
```
https://your-production-domain.com/api/auth/google/callback
https://www.your-production-domain.com/api/auth/google/callback
```

**Keep localhost for development:**
```
http://localhost:3000/api/auth/google/callback
http://localhost:3001/api/auth/google/callback
```

### Step 3: Environment Variables for Production

Make sure these are set in your production environment (Vercel/Netlify):

```env
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Google Drive Folder IDs (same as development)
NEXT_PUBLIC_GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID=your_folder_id
NEXT_PUBLIC_GOOGLE_DRIVE_IG_POSTS_FOLDER_ID=your_folder_id
NEXT_PUBLIC_GOOGLE_DRIVE_IG_REELS_FOLDER_ID=your_folder_id
NEXT_PUBLIC_GOOGLE_DRIVE_MISC_FOLDER_ID=your_folder_id

# Clerk (get production keys from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx

# Database (production database URL)
DATABASE_URL=your_production_database_url
```

### Step 4: Vercel Deployment Example

If deploying to Vercel:

1. **Go to Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **Add all environment variables** from your `.env.local` file

3. **Update OAuth redirect URL** in your app to use the production URL:
   - Instead of `http://localhost:3000/api/auth/google/callback`
   - Use `https://your-app.vercel.app/api/auth/google/callback`

4. **For custom domains**, add both:
   ```
   https://your-app.vercel.app/api/auth/google/callback
   https://your-custom-domain.com/api/auth/google/callback
   ```

### Step 5: Test OAuth Flow in Production

After deployment:

1. ✅ Navigate to Social Media page
2. ✅ Click "Import from Drive"
3. ✅ Should redirect to Google login
4. ✅ After authorization, should redirect back to your app
5. ✅ Check that access token is stored in localStorage

### Common Issues & Solutions

#### Issue 1: "redirect_uri_mismatch" Error
**Solution**: Make sure the redirect URI in Google Console EXACTLY matches the one your app is using (including https/http, trailing slashes, etc.)

#### Issue 2: OAuth works locally but not in production
**Solution**: 
- Check that production URLs are added to Google Console
- Verify environment variables are set in production
- Ensure using `https://` not `http://` for production URLs

#### Issue 3: CORS errors
**Solution**: Google Drive API should allow your production domain. If issues persist, check API restrictions in Google Cloud Console.

### OAuth Flow Overview

```
User clicks "Import from Drive"
    ↓
App redirects to Google OAuth
    ↓
User authorizes access
    ↓
Google redirects back to: https://your-domain.com/api/auth/google/callback
    ↓
Callback handler extracts access_token
    ↓
Redirects to social media page with token in URL params
    ↓
Token stored in localStorage
    ↓
User can now browse Google Drive files
```

### Security Notes

1. **Never commit** `.env.local` to git
2. **Use different OAuth credentials** for development vs production (recommended)
3. **Rotate secrets** regularly
4. **Monitor** OAuth usage in Google Cloud Console
5. **Set appropriate scopes** - only request what you need:
   ```
   https://www.googleapis.com/auth/drive.readonly
   ```

### Multi-Environment Setup (Recommended)

Create separate OAuth clients for each environment:

| Environment | OAuth Client Name | Redirect URI |
|------------|------------------|--------------|
| Development | `App Name (Dev)` | `http://localhost:3000/api/auth/google/callback` |
| Staging | `App Name (Staging)` | `https://staging.domain.com/api/auth/google/callback` |
| Production | `App Name (Prod)` | `https://domain.com/api/auth/google/callback` |

This allows you to:
- Track usage per environment
- Revoke access independently
- Different rate limits if needed

### Need Help?

If OAuth isn't working in production:

1. Check browser console for errors
2. Check Network tab for failed requests
3. Verify redirect URI matches exactly
4. Ensure HTTPS is used (not HTTP)
5. Check Google Cloud Console → APIs & Services → Credentials

---

## Quick Checklist Before Deploying

- [ ] Added production URLs to Google Cloud Console (Authorized JavaScript Origins)
- [ ] Added production callback URLs to Google Cloud Console (Authorized Redirect URIs)
- [ ] Set all environment variables in production hosting platform
- [ ] Updated Clerk keys to production keys (pk_live_*, sk_live_*)
- [ ] Database URL points to production database
- [ ] Tested OAuth flow in production
- [ ] Set user roles in Clerk Dashboard for production users
- [ ] Google Drive folder IDs are correct
- [ ] HTTPS is enforced on production domain
