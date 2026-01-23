# Vercel Deployment Guide

## Overview
With Vercel, **everything runs in the cloud** - your app, API routes, file processing, everything. Your local machine is only for development.

## Prerequisites
1. A GitHub/GitLab/Bitbucket account
2. Your code pushed to a repository
3. Your Firebase and OpenAI environment variables ready

## Step 1: Push to GitHub

If you haven't already:

```bash
# Initialize git (if not already done)
git init

# Add all files (except .env.local - that stays local)
git add .

# Commit
git commit -m "Initial commit"

# Create a repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Via Web Interface (Easiest)

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "Add New Project"
4. Import your repository
5. Vercel will auto-detect Next.js settings
6. **Add Environment Variables:**
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `OPENAI_API_KEY` (optional, for AI labeling)
7. Click "Deploy"

### Option B: Via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? (press enter for default)
# - Directory? ./
# - Override settings? No

# For production deployment:
vercel --prod
```

## Step 3: Add Environment Variables

After initial deployment, add environment variables:

1. Go to your project on Vercel dashboard
2. Settings → Environment Variables
3. Add each variable from your `.env.local`:
   - All `NEXT_PUBLIC_*` variables
   - `OPENAI_API_KEY` (if using AI labeling)

**Important:** 
- `NEXT_PUBLIC_*` variables are exposed to the browser
- `OPENAI_API_KEY` should NOT have `NEXT_PUBLIC_` prefix (server-only)

## Step 4: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your domain
3. Follow DNS instructions
4. Vercel handles SSL automatically

## How It Works

- **Development:** Run `npm run dev` locally (your machine)
- **Production:** Runs on Vercel's servers (cloud)
- **API Routes:** `/api/*` routes run as serverless functions
- **Static Files:** Served from Vercel's global CDN
- **Database:** Firebase (already in cloud)
- **Storage:** Firebase Storage (already in cloud)

## Important Notes

1. **Never commit `.env.local`** - it's in `.gitignore`
2. **Environment variables** must be added in Vercel dashboard
3. **File uploads** go to Firebase Storage (not Vercel)
4. **PDF processing** happens in serverless functions (cloud)
5. **Each deployment** gets a unique URL + your custom domain

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Check build logs in Vercel dashboard
- Ensure `package.json` has correct scripts

### API Routes Not Working
- Check serverless function logs in Vercel dashboard
- Verify environment variables are set
- Check function timeout (default 10s, can increase)

### Images Not Loading
- Ensure images are in `public/` folder
- Check file paths are correct
- Clear browser cache

## Cost

**Free Tier Includes:**
- 100GB bandwidth/month
- Unlimited serverless function invocations
- Automatic SSL
- Custom domains
- Preview deployments

**Paid Plans:**
- Start at $20/month for more bandwidth/features
- Free tier is usually sufficient for most apps

## Next Steps After Deployment

1. Test all features on production URL
2. Set up custom domain (optional)
3. Configure Firebase CORS for production domain
4. Test authentication flows
5. Monitor usage in Vercel dashboard
