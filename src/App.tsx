import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as authSignOut } from "firebase/auth";
import { auth } from "./firebase";
import { supabase } from "./supabaseClient";
import { Login } from "./components/Login";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserDashboard } from "./components/UserDashboard";
import { Onboarding } from "./components/Onboarding";
import "./App.css";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adminView, setAdminView] = useState<"user" | "admin">("user");

  // Toast notification dispatcher
  const showToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
    let usersChannel: any = null;

    const fetchUserProfile = async (uid: string, email: string | null) => {
      if (!email) {
        await authSignOut(auth);
        showToast("Access Denied: No email address associated with this account.", "error");
        setAuthLoading(false);
        return;
      }

      const emailLower = email.toLowerCase();

      // 1. First search by UID
      let { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("uid", uid)
        .maybeSingle();

      if (error) {
        console.error("Supabase user profile fetch by UID error:", error);
      }

      // 2. If not found by UID, search by email (handles first-time Google sign-ins)
      if (!data) {
        const { data: emailData, error: emailError } = await supabase
          .from("users")
          .select("*")
          .eq("email", emailLower)
          .maybeSingle();

        if (emailError) {
          console.error("Supabase user profile fetch by email error:", emailError);
        }

        if (emailData) {
          data = emailData;
          // Update the database record with the new Google UID to link them
          const { error: updateErr } = await supabase
            .from("users")
            .update({ uid: uid })
            .eq("email", emailLower);

          if (updateErr) {
            console.error("Error updating user UID in database:", updateErr);
          } else {
            data.uid = uid;
          }
        }
      }

      if (data) {
        setUserProfile(data);
      } else {
        // Not registered by Admin. Log out immediately!
        await authSignOut(auth);
        showToast("Access Denied: Your email is not registered by the administrator.", "error");
      }
      setAuthLoading(false);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthLoading(true);
      if (user) {
        setCurrentUser(user);
        fetchUserProfile(user.uid, user.email);

        // Listen to changes in the users table for this specific user in real-time
        if (usersChannel) {
          supabase.removeChannel(usersChannel);
        }

        usersChannel = supabase
          .channel(`user-profile-${user.uid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "users", filter: `uid=eq.${user.uid}` },
            (payload) => {
              if (payload.new && Object.keys(payload.new).length > 0) {
                setUserProfile(payload.new);
              }
            }
          )
          .subscribe();
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setAuthLoading(false);
        if (usersChannel) {
          supabase.removeChannel(usersChannel);
          usersChannel = null;
        }
      }
    });

    return () => {
      unsubAuth();
      if (usersChannel) {
        supabase.removeChannel(usersChannel);
      }
    };
  }, []);


  // Display Loading State
  if (authLoading) {
    return (
      <div className="auth-container">
        <div className="spinner-wrapper">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification Mount Point */}
      <div className="toast-msg-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-msg ${t.type}`}>
            {t.type === "success" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>

      {/* Main Screen Router */}
      {!currentUser ? (
        <Login onShowToast={showToast} />
      ) : userProfile?.role === "admin" && adminView === "admin" ? (
        <AdminDashboard
          onShowToast={showToast}
          currentUser={currentUser}
          onBackToUser={() => setAdminView("user")}
        />
      ) : userProfile?.onboarding === false ? (
        <Onboarding
          onShowToast={showToast}
          currentUser={currentUser}
          userProfile={userProfile}
          onComplete={(updatedProfile) => setUserProfile(updatedProfile)}
        />
      ) : (
        <UserDashboard
          onShowToast={showToast}
          currentUser={currentUser}
          userProfile={userProfile}
          onNavigateToAdmin={
            userProfile?.role === "admin" ? () => setAdminView("admin") : undefined
          }
        />
      )}
    </>
  );
};

export default App;
