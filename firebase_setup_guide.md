# Firebase Connection & Setup Guide

To connect this React application with your Firebase project, you need to retrieve your Firebase project's configuration object and save it locally in your environment variables.

---

## 1. Firebase Details Needed

You need the following credentials from your Firebase project configuration:

- **API Key** (`apiKey`)
- **Auth Domain** (`authDomain`)
- **Project ID** (`projectId`)
- **Storage Bucket** (`storageBucket`)
- **Messaging Sender ID** (`messagingSenderId`)
- **App ID** (`appId`)
- **Measurement ID** (`measurementId` - optional, for Analytics)

---

## 2. How to Retrieve the Details from Firebase Console

Follow these steps to find your configuration details:

1. **Go to Firebase Console**:
   Open [Firebase Console](https://console.firebase.google.com/) and select your project.

2. **Register a Web App**:
   - On the Project Overview page, click the **Web icon** (`</>`) in the center of the page.
   - Enter an app nickname (e.g., `web-task-scheduler`).
   - Click **Register app**.

3. **Get the Configuration Object**:
   - Once registered, Firebase will show a code snippet containing a `firebaseConfig` object.
   - It will look like this:
     ```javascript
     const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID",
       measurementId: "YOUR_MEASUREMENT_ID"
     };
     ```
   - Keep this screen open or copy the configuration values.

4. **Accessing Settings Later**:
   - If you already registered the app, click the **Gear/Settings icon** next to *Project Overview* in the left sidebar and select **Project settings**.
   - Scroll down to the *Your apps* section.
   - Select your Web app, choose the **Config** option button, and copy the config values.

---

## 3. Saving Credentials Locally (.env.local)

For security, do not hardcode these keys. Store them in a local environment file.

1. In the root of your project, create a new file named `.env.local`.
2. Copy the template from [.env.example](file:///k:/projects/Web_Task_Scheduler/.env.example) and replace the placeholders with your actual values:
   ```env
   VITE_FIREBASE_API_KEY=YOUR_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID=YOUR_APP_ID
   VITE_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID
   ```

---

## 4. Hosting on Vercel & Netlify (Backend-Only Integration)

Since you are hosting the React frontend on **Vercel** or **Netlify** while using Firebase purely as your backend (database, authentication, etc.), your React client-side application will still query Firebase directly from the user's browser.

You must set up the environment variables on your hosting provider so they are injected during the build step.

### Option A: Vercel Setup

1. **Import Project to Vercel**:
   Push your repository to GitHub, GitLab, or Bitbucket, and import it into Vercel.

2. **Add Environment Variables**:
   - Go to your Vercel Dashboard and select your project.
   - Navigate to **Settings** > **Environment Variables**.
   - Add each of the environment variables from your `.env.local` file:
     - Name: `VITE_FIREBASE_API_KEY`, Value: `your-api-key`
     - Name: `VITE_FIREBASE_AUTH_DOMAIN`, Value: `your-auth-domain`
     - (And so on for all 7 variables)
   - Click **Save**.

3. **Configure Single Page Application (SPA) Routing**:
   To prevent `404` errors when refreshing routes in React, add a `vercel.json` file in your root folder:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/" }]
   }
   ```

---

### Option B: Netlify Setup

1. **Import Project to Netlify**:
   Connect Netlify to your Git repository.

2. **Add Environment Variables**:
   - Go to your Netlify Dashboard and select your site.
   - Go to **Site Configuration** > **Environment variables** > **Add a variable** > **Import from .env**.
   - Paste the contents of your `.env.local` file directly to import all keys.
   - Click **Save**.

3. **Configure SPA Routing**:
   Create a file named `_redirects` in the `public/` directory with the following content:
   ```text
   /*    /index.html   200
   ```

---

## 5. Next Steps

Once you have added the values to `.env.local` (for local development) and to your hosting provider settings (for production), the initialized Firebase SDK in [src/firebase.ts](file:///k:/projects/Web_Task_Scheduler/src/firebase.ts) will automatically establish the connection to your Firebase backend.

