# Quick Start Checklist

## What You Need to Provide

### 1. Firebase Project Configuration

You'll need these values from your Firebase project:

- **API Key**: Found in Firebase Console > Project Settings > General > Your apps
- **Auth Domain**: `your-project-id.firebaseapp.com`
- **Project ID**: Your Firebase project ID
- **Storage Bucket**: `your-project-id.appspot.com`
- **Messaging Sender ID**: Found in Project Settings
- **App ID**: Found in Project Settings

### 2. Firebase Console Setup Steps

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com/
   - Create a new project or select existing

2. **Enable Authentication**
   - Go to Authentication > Get started
   - Enable **Email/Password**
   - Enable **Google** (add support email)
   - Enable **Apple** (add support email, requires Apple Developer account)

3. **Create Firestore Database**
   - Go to Firestore Database > Create database
   - Start in test mode (for development)
   - Choose a location

4. **Enable Storage**
   - Go to Storage > Get started
   - Start in test mode (for development)
   - Choose a location (match Firestore location)

5. **Get Configuration**
   - Go to Project Settings > General
   - Scroll to "Your apps"
   - Click web icon (`</>`) to add web app
   - Copy the config values

### 3. Environment Variables

Create a `.env.local` file in the project root with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Optional: Firebase Admin (for production)

If you want server-side token verification:

1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download JSON file
4. Add to `.env.local`:

```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...your key...\n-----END PRIVATE KEY-----\n"
```

**Important**: Private key must be on one line with `\n` for newlines.

## Running the App

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Create `.env.local` with your Firebase config

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

5. Sign in and upload your first PDF!

## Security Rules (For Production)

### Firestore Rules
```javascript
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

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting

- **Can't sign in**: Check that authentication methods are enabled in Firebase Console
- **Upload fails**: Verify Storage is enabled and rules allow authenticated users
- **Documents not saving**: Check Firestore is enabled and rules are correct
- **Build errors**: Make sure all environment variables are set in `.env.local`

## Need Help?

See `SETUP.md` for detailed step-by-step instructions with screenshots guidance.
