# Firebase Security Rules for Production Mode

Since you created Firestore and Storage in **production mode**, you need to set up security rules. Copy and paste these rules into your Firebase Console.

## Firestore Rules

1. Go to **Firestore Database** > **Rules** tab
2. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Documents collection - users can only access their own documents
    match /documents/{documentId} {
      // Allow read if user owns the document
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      
      // Allow create if user is authenticated and sets their own userId
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      
      // Allow update if user owns the document
      allow update: if request.auth != null && request.auth.uid == resource.data.userId;
      
      // Allow delete if user owns the document
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

3. Click **Publish**

## Storage Rules

1. Go to **Storage** > **Rules** tab
2. Replace the existing rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access files in their own user folder
    match /users/{userId}/{allPaths=**} {
      // Allow read and write if the user is authenticated and matches the userId in the path
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish**

## What These Rules Do

- **Firestore**: Users can only read/write documents where `userId` matches their authenticated user ID
- **Storage**: Users can only access files in their own `users/{userId}/` folder

This ensures users can only access their own data.
