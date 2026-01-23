# Document Filler

A Next.js application for automatically filling PDF forms.

A modern Next.js application for automatically filling PDF forms. Upload a PDF, detect form fields, fill them out in a clean interface, and generate filled PDFs.

## Features

- 🔐 **Authentication**: Sign in with Google, Apple, or Email/Password
- 📄 **PDF Processing**: Automatic form field detection
- 💾 **Document Storage**: Save and manage your PDFs in Firestore
- 🎨 **Modern UI**: ChatGPT-inspired design with smooth animations
- ⚡ **Fast**: Client-side PDF processing with pdf-lib

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase configuration (see Setup Guide below)

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Firebase Setup Guide

See `SETUP.md` for detailed Firebase configuration instructions.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **PDF Processing**: pdf-lib
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **Storage**: Firebase Storage

## Project Structure

```
DocumentFiller/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── login/          # Login page
│   └── page.tsx        # Main dashboard
├── components/         # React components
│   ├── Auth/          # Authentication components
│   ├── Layout/        # Layout components
│   └── ...            # Other components
├── lib/               # Utility functions
│   ├── firebase/      # Firebase configuration
│   ├── firestore/     # Firestore helpers
│   └── ...            # PDF processing
└── types/             # TypeScript types
```

## License

ISC
