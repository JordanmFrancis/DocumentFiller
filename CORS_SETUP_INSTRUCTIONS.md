# How to Configure CORS for Firebase Storage

## Method 1: Using Google Cloud Console (Easiest)

1. Go to [Google Cloud Console](https://console.cloud.google.com/storage/browser)
2. Select your project: **arronsite-9cf1b**
3. Click on your bucket: **arronsite-9cf1b.firebasestorage.app**
4. Click the **Configuration** tab (you're already there!)
5. In the **Overview** section, find **Cross-origin resource sharing**
6. Click the **edit icon** (pencil icon) next to "Not enabled"
7. Click **Add CORS configuration**
8. Paste this JSON:

```json
[
  {
    "origin": ["http://localhost:3000", "https://arronsite-9cf1b.web.app", "https://arronsite-9cf1b.firebaseapp.com"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

9. Click **Save**

## Method 2: Using gsutil (Command Line)

### Step 1: Install Google Cloud SDK

**On macOS:**
```bash
# If you have Homebrew:
brew install --cask google-cloud-sdk

# Or download from:
# https://cloud.google.com/sdk/docs/install
```

**On Windows:**
Download and install from: https://cloud.google.com/sdk/docs/install

### Step 2: Authenticate

```bash
gcloud auth login
```

### Step 3: Set CORS Configuration

I've already created a `cors.json` file in your project. Run:

```bash
gsutil cors set cors.json gs://arronsite-9cf1b.firebasestorage.app
```

## Method 3: Using Firebase Console (Alternative)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Storage**
4. Click on the **Rules** tab
5. This is for security rules, not CORS, but you can also check here

## Verify CORS is Working

After configuring CORS:

1. Refresh your browser
2. Try loading an existing document
3. Check the browser console - CORS errors should be gone

## Troubleshooting

**If you don't see the edit icon:**
- Make sure you have the right permissions (Owner or Storage Admin)
- Try refreshing the page
- The edit icon should be a small pencil/edit icon next to "Cross-origin resource sharing"

**If gsutil command doesn't work:**
- Make sure Google Cloud SDK is installed and in your PATH
- Run `gcloud auth login` first
- Make sure you're authenticated with the correct account

## Need Help?

If you're still having issues, you can:
1. Take a screenshot of what you see in the Configuration tab
2. Or use the gsutil method which is more reliable
