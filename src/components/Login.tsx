import React, { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as authSignOut,
  signInWithCredential
} from "firebase/auth";
import { auth } from "../firebase";
import { supabase } from "../supabaseClient";
import { SpotlightCard, ShinyText, BlurReveal } from "./reactbits";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';


interface LoginProps {
  onShowToast: (message: string, type: "success" | "error") => void;
}

export const Login: React.FC<LoginProps> = ({ onShowToast }) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize();
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      let idToken = "";

      if (Capacitor.isNativePlatform()) {
        const nativeUser = await GoogleAuth.signIn();
        idToken = nativeUser.authentication.idToken;
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const userCredential = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(userCredential);
        idToken = credential?.idToken || "";
      }

      if (!idToken) {
        throw new Error("No ID Token returned from Google authentication.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      if (!user.email) {
        await authSignOut(auth);
        onShowToast("Authentication failed: No email returned from Google.", "error");
        setLoading(false);
        return;
      }

      // Check if email exists in Supabase users table
      const { data: userSnap, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();

      if (userError) {
        console.error("Supabase user check error:", userError);
      }

      if (!userSnap) {
        // Not registered by Admin! Sign out immediately
        await authSignOut(auth);
        onShowToast("Access Denied: Your email is not registered by the administrator.", "error");
      } else {
        // If registered, make sure UID in the database matches current Auth UID
        if (userSnap.uid !== user.uid) {
          const { error: updateErr } = await supabase
            .from("users")
            .update({ uid: user.uid })
            .eq("email", user.email.toLowerCase());

          if (updateErr) {
            console.error("Error updating user UID in database:", updateErr);
          }
        }
        onShowToast("Welcome back!", "success");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        onShowToast(err.message || "Failed to sign in with Google.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      onShowToast("Please enter username/email and password.", "error");
      return;
    }

    setLoading(true);
    const inputVal = usernameOrEmail.trim();
    const isEmail = inputVal.includes("@");
    let targetEmail = inputVal;

    try {
      if (!isEmail) {
        // Query user document by username from Supabase
        const { data: userSnap, error: userError } = await supabase
          .from("users")
          .select("email")
          .eq("username", inputVal.toLowerCase())
          .maybeSingle();

        if (userError) {
          console.error("Supabase username query error:", userError);
        }

        if (!userSnap) {
          onShowToast("Invalid username or password.", "error");
          setLoading(false);
          return;
        } else {
          targetEmail = userSnap.email;
        }
      }

      // Attempt authentication with resolved email address
      await signInWithEmailAndPassword(auth, targetEmail, password);
      onShowToast("Welcome back!", "success");
    } catch (loginErr: any) {
      // General authentication errors
      let errorMsg = "Authentication failed. Please check your credentials.";
      if (
        loginErr.code === "auth/invalid-credential" ||
        loginErr.code === "auth/wrong-password" ||
        loginErr.code === "auth/user-not-found"
      ) {
        errorMsg = "Invalid username/email or password.";
      } else if (loginErr.code === "auth/too-many-requests") {
        errorMsg = "Access temporarily disabled due to too many failed login attempts.";
      }
      onShowToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <SpotlightCard className="auth-card" spotlightColor="rgba(99, 102, 241, 0.12)">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/favicon.svg" alt="Sydions Logo" style={{ width: '52px', height: '52px', display: 'block', margin: '0 auto 0.75rem', filter: 'drop-shadow(0 0 16px rgba(134,59,255,0.6))' }} />
            <ShinyText text="Sydions Scheduler" speed={3.5} />
          </div>
          <p className="auth-subtitle">
            <BlurReveal text="Gamified Task Scheduling & EXP Engine" duration={0.8} />
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username-email-input">
              Username or Email
            </label>
            <input
              id="username-email-input"
              type="text"
              className="form-control"
              placeholder="Username or email address"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">
              Password
            </label>
            <input
              id="password-input"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: "1.5rem" }}
            disabled={loading}
          >
            {loading ? "Authenticating..." : <ShinyText text="Sign In" speed={3} disabled={false} />}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-block google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 15.02 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2 3.7-5.02 3.7-8.71z"
              />
              <path
                fill="#FBBC05"
                d="M5.24 10.55c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.39 7.2c-.79 1.59-1.24 3.38-1.24 5.27s.45 3.68 1.24 5.27l3.85-2.99z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.04.7-2.37 1.11-4.23 1.11-3.34 0-5.86-1.81-6.76-4.51L1.39 16.8C3.37 20.69 7.35 23 12 23z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>
      </SpotlightCard>
    </div>
  );
};
