# Firebase Storage CORS Configuration

## The Problem
When loading existing documents, you may see CORS errors in the console. This happens because Firebase Storage needs CORS headers configured to allow downloads from your domain.

## Solution: Configure CORS in Firebase Storage

### Option 1: Using gsutil (Recommended)

1. Create a CORS configuration file named `cors.json`:

```json
[
  {
    "origin": ["http://localhost:3000", "https://yourdomain.com"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

2. Apply the CORS configuration:

```bash
gsutil cors set cors.json gs://YOUR_STORAGE_BUCKET
```

Replace `YOUR_STORAGE_BUCKET` with your Firebase Storage bucket name (e.g., `arronsite-9cf1b.firebasestorage.app`)

### Option 2: Using Firebase Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **Cloud Storage** > **Buckets**
4. Click on your storage bucket
5. Go to the **Configuration** tab
6. Click **Edit CORS configuration**
7. Add this configuration:

```json
[
  {
    "origin": ["http://localhost:3000", "https://yourdomain.com"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

8. Click **Save**

### Option 3: Quick Fix for Development

For local development, you can temporarily use a proxy. However, the proper solution is to configure CORS as shown above.

## Verify CORS is Working

After configuring CORS, refresh your browser and try loading an existing document. The CORS errors should be gone.

## Note

- Replace `http://localhost:3000` with your actual development URL
- Replace `https://yourdomain.com` with your production domain when you deploy
- You can add multiple origins in the array
