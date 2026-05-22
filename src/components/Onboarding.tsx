import React, { useState } from "react";
import { updatePassword, signOut as authSignOut } from "firebase/auth";
import { auth } from "../firebase";
import { supabase } from "../supabaseClient";
import { SpotlightCard, ShinyText, BlurReveal } from "./reactbits";

interface OnboardingProps {
  onShowToast: (message: string, type: "success" | "error") => void;
  currentUser: any;
  userProfile: any;
  onComplete: (updatedProfile: any) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({
  onShowToast,
  currentUser,
  userProfile,
  onComplete,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      onShowToast("Please fill in all fields.", "error");
      return;
    }

    if (password.length < 6) {
      onShowToast("Password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      onShowToast("Passwords do not match.", "error");
      return;
    }

    setLoading(true);
    try {
      // 1. Update Firebase Auth password
      await updatePassword(currentUser, password);

      // 2. Update Supabase users table setting onboarding to true
      const { error: updateError } = await supabase
        .from("users")
        .update({ onboarding: true })
        .eq("uid", currentUser.uid);

      if (updateError) {
        throw new Error(updateError.message);
      }

      onShowToast("Password configured successfully! Welcome onboard.", "success");
      
      // Notify parent app of updated onboarding state
      onComplete({
        ...userProfile,
        onboarding: true,
      });
    } catch (err: any) {
      console.error("Onboarding setup failed:", err);
      let errMsg = err.message || "Failed to set password.";
      if (err.code === "auth/requires-recent-login") {
        errMsg = "For security reasons, please log out and log back in to set your password.";
      }
      onShowToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authSignOut(auth);
      onShowToast("Signed out successfully.", "success");
    } catch (err: any) {
      console.error(err);
      onShowToast("Failed to sign out.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <SpotlightCard className="auth-card" spotlightColor="rgba(99, 102, 241, 0.12)">
        <div className="auth-header">
          <div className="auth-logo">
            <ShinyText text="Welcome Onboard!" speed={3.5} />
          </div>
          <p className="auth-subtitle">
            <BlurReveal text="Please configure a new password for your account to get started." duration={0.8} />
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              className="form-control"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="form-control"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: "1.5rem" }}
            disabled={loading}
          >
            {loading ? "Configuring Account..." : "Save Password & Enter"}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={handleSignOut}
            disabled={loading}
          >
            Log Out
          </button>
        </form>
      </SpotlightCard>
    </div>
  );
};
