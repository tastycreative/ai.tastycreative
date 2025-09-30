# AWS S3 Integration Setup Guide for Text-to-Image

This guide will help you set up AWS S3 storage for your text-to-image generations, eliminating Vercel bandwidth usage completely.

## 🏗️ **Step 1: Create AWS S3 Bucket**

### A. AWS Console Setup
1. Go to [aws.amazon.com](https://aws.amazon.com) and sign in
2. Search for "S3" and click on **S3** service
3. Click **"Create bucket"**

### B. Bucket Configuration
- **Bucket name**: `tastycreative-ai-media` (or choose your own unique name)
- **AWS Region**: `us-east-1` (or closest to your users)
- **Block Public Access**: 
  - ✅ **UNCHECK "Block all public access"**
  - ✅ Check the acknowledgment box
- **Bucket Versioning**: Disabled
- **Default encryption**: Server-side encryption with Amazon S3 managed keys (SSE-S3)
- Click **"Create bucket"**

### C. Configure Bucket Policy
1. Go to your bucket → **Permissions** tab
2. **Bucket policy** → **Edit**
3. Paste this policy (replace `YOUR-BUCKET-NAME`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
    ]
}
```

### D. Configure CORS
1. **Permissions** tab → **Cross-origin resource sharing (CORS)** → **Edit**
2. Paste this CORS configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["Content-Length", "Content-Range"],
        "MaxAgeSeconds": 3600
    }
]
```

## 🔑 **Step 2: Create AWS Access Keys**

### A. Create IAM User
1. Go to **IAM service** → **Users** → **Create user**
2. **User name**: `tastycreative-s3-user`
3. **Permissions**: Attach policies directly
4. Search and select: **AmazonS3FullAccess**
5. **Create user**

### B. Create Access Keys
1. Click on your new user → **Security credentials** tab
2. **Access keys** → **Create access key**
3. **Use case**: Application running outside AWS
4. **Create access key**
5. **IMPORTANT**: Copy both keys immediately:
   - **Access key ID**
   - **Secret access key**

## 💻 **Step 3: Update Environment Variables**

Add these to your `.env.local` file:

```bash
# AWS S3 Configuration for Media Storage
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name-here

# AWS S3 URLs for direct access (no Vercel bandwidth usage)
NEXT_PUBLIC_AWS_S3_BUCKET=your-bucket-name-here
NEXT_PUBLIC_AWS_REGION=us-east-1
```

Replace:
- `your_access_key_id_here` with your actual Access Key ID
- `your_secret_access_key_here` with your actual Secret Access Key  
- `your-bucket-name-here` with your actual bucket name

## 🔄 **Step 4: Database Migration**

Run the database migration to add AWS S3 fields:

```bash
npx prisma migrate dev --name add-aws-s3-fields
```

If you get conflicts, reset and migrate:

```bash
npx prisma migrate reset
npx prisma migrate dev
npx prisma generate
```

## 📦 **Step 5: Install AWS SDK**

Install the AWS SDK for JavaScript:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## 🚀 **Step 6: Deploy RunPod Handler**

Your RunPod handler needs to be updated with AWS S3 credentials:

### A. Add Environment Variables to RunPod
In your RunPod serverless endpoint, add these environment variables:
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_REGION`: us-east-1 (or your chosen region)
- `AWS_S3_BUCKET`: Your bucket name

### B. Deploy Updated Handler
Run your build script to deploy the updated handler:

```bash
./build-and-push-handler.sh
```

## 🧪 **Step 7: Test the Integration**

1. **Generate a test image** through your text-to-image interface
2. **Check the logs** for AWS S3 upload messages:
   ```
   📤 Uploading image to AWS S3: outputs/user_xxx/filename.png
   ✅ Image uploaded to AWS S3: https://your-bucket.s3.amazonaws.com/outputs/user_xxx/filename.png
   ☁️ AWS S3 URL: https://your-bucket.s3.amazonaws.com/outputs/user_xxx/filename.png
   ```
3. **Verify the image loads** directly from the AWS URL
4. **Check your bucket** in AWS console to see the uploaded files

## 📊 **Expected Results**

### Before AWS S3:
- ❌ **100% traffic** through Vercel proxy routes
- ❌ **High bandwidth** usage on Vercel
- ❌ **Slower load times** due to proxy

### After AWS S3:
- ✅ **Direct URLs** to AWS S3 (no Vercel proxy)
- ✅ **95%+ bandwidth reduction** on Vercel
- ✅ **Faster load times** from AWS edge locations
- ✅ **Global CDN** capabilities with CloudFront
- ✅ **Automatic scaling** with AWS infrastructure

## 🔍 **Troubleshooting**

### Issue: Access Denied Error
**Solution**: Check bucket policy and ensure IAM user has S3 permissions

### Issue: CORS Error in Browser
**Solution**: Verify CORS configuration in bucket settings

### Issue: Images Not Uploading
**Solution**: Check environment variables in both your app and RunPod handler

### Issue: Database Errors
**Solution**: Run `npx prisma migrate dev` and `npx prisma generate`

## 🎯 **Next Steps**

1. **Monitor bandwidth usage** in Vercel dashboard
2. **Update other pages** to use the new AWS S3 URLs
3. **Consider CloudFront CDN** for even faster global delivery
4. **Set up lifecycle policies** to manage storage costs

## 💰 **Cost Optimization**

- **S3 Standard**: ~$0.023/GB/month
- **Data transfer OUT**: First 100GB free, then ~$0.09/GB
- **Requests**: ~$0.0004 per 1,000 GET requests

This is significantly cheaper than Vercel bandwidth for high-traffic applications.

## 🔒 **Security Best Practices**

1. **Bucket Policy**: Only allow public read access (no write/delete)
2. **IAM User**: Only has S3 permissions, no other AWS services
3. **Environment Variables**: Keep AWS keys secure and never commit to git
4. **Access Logging**: Enable S3 access logging for monitoring (optional)

Your AWS S3 integration is now ready! Every new text-to-image generation will be automatically saved to AWS S3 with direct URLs, eliminating Vercel bandwidth usage.