# eSSF Helper

The requester-facing companion app to eSSF Bench. A landing page plus the
**Sample & Batch ID Editor** tool, wired together as one deployable React app.

## What's inside
```
essf-helper/
├─ index.html              page shell + gradient background
├─ package.json            dependencies & scripts
├─ vite.config.js          build config
├─ public/
│  └─ favicon.svg          app icon (eSSF bridge mark)
└─ src/
   ├─ main.jsx             React entry point
   ├─ App.jsx              navigation: landing ⇄ editor
   ├─ Landing.jsx          the landing page (logo, greeting, tiles, footer)
   └─ SampleBatchEditor.jsx  THE TOOL — single source of truth, shared with Bench
```

## Editing the tool
`src/SampleBatchEditor.jsx` is the same component used standalone and in Bench.
Edit it here; to keep Bench in sync, copy the whole file across. (See the
Sample & Batch Editor handoff note.)

## Run locally
```
npm install
npm run dev        # opens a local dev server with hot reload
```

## Build / deploy
```
npm run build      # outputs to dist/
```
Deploy to Vercel: push this folder to GitHub → vercel.com → Add New → Project →
pick the repo → Deploy. Vite is auto-detected. See the
**eSSF Helper Setup & Deployment Guide** for custom domain + favicon steps.
