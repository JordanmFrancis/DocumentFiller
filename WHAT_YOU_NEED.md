# What You Need to Provide

## Summary

Your Document Filler app is complete! Here's everything you need to provide to get it running:

## 1. Firebase Configuration Values

You need to create a Firebase project and get these 6 values:

1. **NEXT_PUBLIC_FIREBASE_API_KEY** - API key from Firebase
2. **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN** - Usually `your-project-id.firebaseapp.com`
3. **NEXT_PUBLIC_FIREBASE_PROJECT_ID** - Your Firebase project ID
4. **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET** - Usually `your-project-id.appspot.com`
5. **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID** - From Firebase settings
6. **NEXT_PUBLIC_FIREBASE_APP_ID** - From Firebase settings

## 2. Firebase Console Steps

### Step 1: Create/Select Firebase Project
- Go to https://console.firebase.google.com/
- Create new project or select existing

### Step 2: Enable Authentication
- Navigate to: **Authentication** > **Get started**
- Enable these sign-in methods:
  - ✅ **Email/Password** → Click Enable
  - ✅ **Google** → Click Enable, add support email
  - ✅ **Apple** → Click Enable, add support email (requires Apple Developer account)

### Step 3: Create Firestore Database
- Navigate to: **Firestore Database** > **Create database**
- Choose: **Start in test mode** (for development)
- Select a location (e.g., us-central1)
- Click **Enable**

### Step 4: Enable Firebase Storage
- Navigate to: **Storage** > **Get started**
- Choose: **Start in test mode** (for development)
- Select same location as Firestore
- Click **Done**

### Step 5: Get Your Config Values
- Navigate to: **Project Settings** (gear icon) > **General** tab
- Scroll to **"Your apps"** section
- Click the **web icon** (`</>`) to add a web app
- Register app with a nickname (e.g., "Document Filler Web")
- Copy the `firebaseConfig` object values

## 3. Create Environment File

Create a file named `.env.local` in the project root with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Optional: OpenAI API Key for AI-powered field label generation
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Replace all `your_*` values with your actual Firebase values.

### Optional: OpenAI API Key Setup

To enable AI-powered field label generation:

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Add it to `.env.local` as `OPENAI_API_KEY`

**Note**: AI labeling is optional. If you don't provide an API key, the app will use the default field name cleaning algorithm instead.

## 4. Optional: Firebase Admin SDK (For Production)

If you want server-side authentication verification:

1. Go to **Project Settings** > **Service accounts** tab
2. Click **"Generate new private key"**
3. Download the JSON file
4. Extract these values and add to `.env.local`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...your full key...\n-----END PRIVATE KEY-----\n"
```

**Important**: The private key must be on ONE line with `\n` characters for newlines.

## 5. Run the App

Once you have `.env.local` configured:

```bash
npm run dev
```

Then open http://localhost:3000

## Quick Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Email, Google, Apple)
- [ ] Firestore database created
- [ ] Firebase Storage enabled
- [ ] `.env.local` file created with all 6 Firebase config values
- [ ] (Optional) OpenAI API key added to `.env.local` for AI labeling
- [ ] App runs without errors
- [ ] Can sign in successfully
- [ ] Can upload a PDF

## Security Rules (Update for Production)

After testing, update these in Firebase Console:

### Firestore Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{documentId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### Storage Rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## That's It!

Once you provide the Firebase configuration values in `.env.local`, your app is ready to use!

For detailed instructions, see `SETUP.md` or `QUICK_START.md`.
