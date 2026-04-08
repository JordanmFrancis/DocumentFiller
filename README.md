# Document Filler

AI-powered document field detector and form filler — upload any PDF, get a clean form to fill it out, download the completed document.

![Document Filler screenshot](./public/screenshot.png)

## Why I built this

I got tired of opening PDFs in clunky viewers just to fill in a few fields. I wanted something that felt like filling out a modern web form, no matter how messy the source document was.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · pdf-lib · Firebase (Auth, Firestore, Storage)

## How it works

- Upload a PDF and the app detects existing form fields automatically
- For documents without fields, you can drag-and-drop your own field zones onto the page
- Fill everything out in a clean, ChatGPT-style sidebar form with text that auto-scales to fit
- Download the filled PDF, or save it to your account to revisit later

## Live demo

Coming soon.
