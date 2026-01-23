# Firebase Setup Guide

Follow these steps to configure Firebase for the Document Filler application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter a project name
   - (Optional) Enable Google Analytics
   - Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** > **Get started**
2. Enable the following sign-in methods:
   - **Email/Password**: Click "Enable" and save
   - **Google**: 
     - Click "Enable"
     - Add your project's support email
     - Save
   - **Apple**:
     - Click "Enable"
     - Add your project's support email
     - Configure Apple Sign-In (requires Apple Developer account)
     - Save

## Step 3: Create Firestore Database

1. Go to **Firestore Database** > **Create database**
2. Choose **Start in test mode** (for development) or set up security rules
3. Select a location for your database
4. Click "Enable"

### Firestore Security Rules

For production, update your Firestore rules:

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

## Step 4: Set up Firebase Storage

1. Go to **Storage** > **Get started**
2. Choose **Start in test mode** (for development) or set up security rules
3. Select a location (should match Firestore location)
4. Click "Done"

### Storage Security Rules

For production, update your Storage rules:

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

## Step 5: Get Firebase Configuration

1. Go to **Project Settings** (gear icon) > **General**
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

## Step 6: Configure Environment Variables

1. Create a `.env.local` file in the project root
2. Add your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 7: (Optional) Set up Firebase Admin SDK

For server-side token verification in API routes:

1. Go to **Project Settings** > **Service accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Add to `.env.local`:

```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Note**: The private key should be on a single line with `\n` for newlines.

## Step 8: Configure Authorized Domains

1. Go to **Authentication** > **Settings** > **Authorized domains**
2. Add your domain (localhost is added by default for development)

## Step 9: (Optional) Configure Apple Sign-In

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create an App ID and Service ID
3. Configure Sign in with Apple
4. Add the Service ID in Firebase Console under Authentication > Apple provider

## Verification Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Email, Google, Apple)
- [ ] Firestore database created
- [ ] Firebase Storage enabled
- [ ] Environment variables configured
- [ ] Security rules updated (for production)
- [ ] Authorized domains configured

## Troubleshooting

### Authentication not working
- Check that authentication methods are enabled in Firebase Console
- Verify environment variables are correct
- Check browser console for errors

### Storage upload fails
- Verify Storage is enabled
- Check Storage security rules
- Ensure user is authenticated

### Firestore errors
- Verify Firestore is enabled
- Check Firestore security rules
- Ensure user is authenticated

## Next Steps

Once Firebase is configured:

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Sign in with your preferred method
4. Upload your first PDF!
