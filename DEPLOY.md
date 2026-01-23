# Quick Vercel Deployment

## Everything Runs in the Cloud ✅

With Vercel:
- ✅ Your app runs on Vercel's servers (not your computer)
- ✅ API routes run as serverless functions (cloud)
- ✅ Firebase is already in the cloud
- ✅ File uploads go to Firebase Storage (cloud)
- ✅ PDF processing happens in the cloud
- ✅ You get a public URL (e.g., `your-app.vercel.app`)
- ✅ Can add custom domain (e.g., `yourdomain.com`)

## Quick Start (3 Steps)

### 1. Push to GitHub

```bash
# Initialize git
git init

# Add files
git add .

# Commit
git commit -m "Ready for deployment"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel

**Option A: Web Interface (Easiest)**
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Vercel auto-detects Next.js ✅

**Option B: CLI**
```bash
npm i -g vercel
vercel login
vercel
```

### 3. Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

Add all these from your `.env.local`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `OPENAI_API_KEY` (optional, for AI labeling)

**Important:** 
- Don't add `NEXT_PUBLIC_` prefix to `OPENAI_API_KEY`
- All other Firebase vars keep `NEXT_PUBLIC_` prefix

## That's It! 🎉

After deployment:
- Your app is live at `your-app.vercel.app`
- Every git push auto-deploys
- SSL/HTTPS is automatic
- Add custom domain anytime

## Custom Domain (Optional)

1. Vercel Dashboard → Project → Settings → Domains
2. Add your domain
3. Follow DNS instructions
4. SSL is automatic

## Cost

**Free tier includes:**
- Unlimited deployments
- 100GB bandwidth/month
- Automatic SSL
- Custom domains
- Perfect for most apps!
