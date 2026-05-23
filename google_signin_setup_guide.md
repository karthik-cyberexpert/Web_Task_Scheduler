# Native Google Sign-In Integration Guide for Android (Capacitor & Firebase)

This guide provides step-by-step instructions to integrate native Google Sign-In in the Android Capacitor application and bridge it with Firebase Authentication.

---

## Step 1: Firebase & Google Cloud Console Configuration

To allow authentication on Android devices, Google requires you to register the application's unique SHA-1 fingerprint.

### 1.1 Generate Android SHA-1 Fingerprint
Run the command matching your shell to extract the SHA-1 fingerprint from the local debug keystore:

**For PowerShell:**
```powershell
keytool -list -v -alias androiddebugkey -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android
```

**For Command Prompt (CMD):**
```cmd
keytool -list -v -alias androiddebugkey -keystore "%USERPROFILE%\.android\debug.keystore" -storepass android
```
Copy the **SHA-1** hex string printed in the command output.

### 1.2 Register Android App in Firebase
1. Open the [Firebase Console](https://console.firebase.google.com/) and navigate to your project.
2. Click the gear icon next to **Project Overview** and select **Project settings**.
3. Under the **General** tab, scroll down to **Your apps** and click **Add app** (select Android).
4. Enter the Package Name (Bundle ID): `com.sydions.scheduler`.
5. Paste the copied **SHA-1 fingerprint** into the optional SHA-1 field.
6. Click **Register app**, then download the `google-services.json` configuration file.
7. Click **Next** through the rest of the steps.

### 1.3 Place Config File in Android Project
Move the downloaded `google-services.json` file into your project's native android folder:
`android/app/google-services.json`

---

## Step 2: Install Capacitor Google Auth Plugin

Install the official Capacitor Google Auth community plugin which handles native SDK prompt triggers.

```bash
npm install @codetrix-studio/capacitor-google-auth
npx cap sync
```

---

## Step 3: Configure Client Identifiers

You must specify the OAuth Client ID so Google knows which project to authenticate against.

### 3.1 Get Web Client ID from Google Cloud
1. Go to the [Google Cloud Credentials Console](https://console.cloud.google.com/apis/credentials).
2. Look for **OAuth 2.0 Client IDs** created automatically by Firebase.
3. Copy the Client ID for the **Web application** type (do NOT copy the Android client ID here, the SDK needs the Web Client ID for authentication).

### 3.2 Update `capacitor.config.ts`
Add the `GoogleAuth` config block under plugins:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sydions.scheduler',
  appName: 'Sydions Scheduler',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
```

### 3.3 Configure Android Resources
Open `android/app/src/main/res/values/strings.xml` and add the server client ID:

```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Sydions Scheduler</string>
    <string name="title_activity_main">Sydions Scheduler</string>
    <string name="package_name">com.sydions.scheduler</string>
    <string name="custom_url_scheme">com.sydions.scheduler</string>
    <string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
</resources>
```

---

## Step 4: Implement Login Logic in React

Update your `src/components/Login.tsx` code to handle native Google sign-in when running on a mobile platform.

### 4.1 Update Imports
```typescript
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
```

### 4.2 Initialize Plugin
Call the initialization helper when the app mounts (e.g., inside a `useEffect` in `App.tsx` or `Login.tsx`):
```typescript
useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    GoogleAuth.initialize();
  }
}, []);
```

### 4.3 Replace `handleGoogleSignIn` Method
Modify the signature to run native login on mobile:

```typescript
const handleGoogleSignIn = async () => {
  setLoading(true);
  try {
    let idToken: string;

    if (Capacitor.isNativePlatform()) {
      // Native Google Sign-In SDK
      const nativeUser = await GoogleAuth.signIn();
      idToken = nativeUser.authentication.idToken;
    } else {
      // Web browser popup sign-in
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const userCredential = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(userCredential);
      idToken = credential?.idToken || '';
    }

    if (!idToken) {
      throw new Error("No ID Token returned from Google authentication.");
    }

    // Sign in to Firebase Auth using the Google credential ID token
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    if (!user.email) {
      await authSignOut(auth);
      onShowToast("Authentication failed: No email returned.", "error");
      return;
    }

    // Check database user existence
    const { data: userSnap, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();

    if (userError) console.error(userError);

    if (!userSnap) {
      await authSignOut(auth);
      onShowToast("Access Denied: Your email is not registered.", "error");
    } else {
      if (userSnap.uid !== user.uid) {
        await supabase
          .from("users")
          .update({ uid: user.uid })
          .eq("email", user.email.toLowerCase());
      }
      onShowToast("Welcome back!", "success");
    }
  } catch (err: any) {
    console.error("Google Sign-In Error:", err);
    onShowToast(err.message || "Failed to sign in with Google.", "error");
  } finally {
    setLoading(false);
  }
};
```
