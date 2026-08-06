# Deploying to Vercel (Free Mode — Firebase + Cloudinary)

## Prerequisites
- Node.js 18+ installed locally
- A Firebase project (Spark/free plan is sufficient)
- A Cloudinary account (free tier: 25 GB storage, 25 GB bandwidth/month)
- A Vercel account (free Hobby plan is sufficient)
- Git repository (GitHub, GitLab, or Bitbucket)

---

## Step 1 — Firebase Project Setup

1. Go to https://console.firebase.google.com → **Add project**.
2. Enable **Firestore Database** in Native mode (choose a region close to your users).
3. Enable **Authentication** → Sign-in method → **Email/Password**.
4. Create your first admin user:
   - Go to Authentication → Users → **Add user** (e.g. `admin@yoursite.com`).
   - Note the generated UID.
5. In Firestore, manually create the admin document:
   - Collection: `admins` → Document ID: `{the UID from step 4}`
   - Fields:
     ```
     id:        "{uid}"
     email:     "admin@yoursite.com"
     name:      "Site Admin"
     role:      "superadmin"
     createdAt: (Timestamp — use the console date picker)
     lastLogin: null
     ```
6. Deploy the Firestore Security Rules:
   - Go to Firestore → **Rules** tab.
   - Replace the content with the rules from `lib/firebase/security-rules.txt`.
   - Click **Publish**.
7. Generate a Service Account key for Admin SDK:
   - Go to Project Settings → **Service accounts** → **Generate new private key**.
   - Download the JSON file.
   - Convert it to a single-line JSON string:
     ```bash
     cat your-service-account.json | jq -c . | pbcopy   # macOS
     cat your-service-account.json | jq -c .             # Linux (copy output)
     ```
   - You will paste this string as `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel.
8. Get your Firebase Web App credentials:
   - Project Settings → Your apps → **Web** → copy the `firebaseConfig` object values.

---

## Step 2 — Cloudinary Setup

1. Log in to https://cloudinary.com → Dashboard.
2. Confirm your Cloud Name is `headlinex` (or update `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` if different).
3. Go to Settings → **Upload** → **Upload presets** → **Add upload preset**:
   - Preset name: `HeadlineX`
   - Signing mode: **Unsigned**
   - Folder: `site-images`
   - Save.

---

## Step 3 — Deploy to Vercel

1. Push your project to a Git repository.
2. Go to https://vercel.com → **Add New Project** → import your repository.
3. Vercel auto-detects Next.js. Leave the build settings at defaults.
4. Under **Environment Variables**, add every variable from `.env.example`:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_BACKEND_MODE` | `firebase` |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase Console |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from Firebase Console |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from Firebase Console |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from Firebase Console |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from Firebase Console |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | single-line JSON string from Step 1.7 |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `headlinex` |
   | `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `HeadlineX` |
   | `NEXT_PUBLIC_CLOUDINARY_FOLDER` | `site-images` |
   | `NEXT_PUBLIC_CLOUDINARY_UPLOAD_URL` | `https://api.cloudinary.com/v1_1/headlinex/image/upload` |
   | `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` |

5. Click **Deploy**. Vercel runs `npm run build` and publishes the app.
6. Once deployed, visit `https://your-project.vercel.app/auth/login` and sign in.

---

## Step 4 — Custom Domain (Optional)

1. In Vercel → Project → **Domains** → add your domain.
2. Update your DNS records as instructed.
3. Update `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com`.
4. Redeploy (trigger a new deploy from the Vercel dashboard or push a commit).

---

## Ongoing Deployments

Every `git push` to the `main` branch triggers an automatic Vercel deployment.
ISR pages on the public site regenerate within 60 seconds of a content change.
Firebase mode pages update in real-time via `onSnapshot` — no redeployment needed.

---

## Notes & Limits (Free Tier)

| Service | Free Limit | Action if exceeded |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth/month | Upgrade to Pro |
| Firebase Spark | 1 GB Firestore storage, 50k reads/day, 20k writes/day | Upgrade to Blaze (pay-as-you-go) |
| Cloudinary Free | 25 GB storage, 25 GB bandwidth/month | Upgrade or use a different cloud name |