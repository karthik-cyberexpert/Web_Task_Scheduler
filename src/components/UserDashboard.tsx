import React, { useState, useEffect } from "react";
import { signOut as authSignOut } from "firebase/auth";
import { auth } from "../firebase";
import { supabase } from "../supabaseClient";
import { SpotlightCard, ShinyText, CountUp, BlurReveal } from "./reactbits";


interface UserDashboardProps {
  onShowToast: (message: string, type: "success" | "error") => void;
  currentUser: any; // User Auth state
  userProfile: any; // User Firestore document profile
  onNavigateToAdmin?: () => void;
}

// Helpers to map Supabase snake_case rows to camelCase formats with mock Firebase timestamps (.toDate())
const mapUser = (u: any) => ({
  uid: u.uid,
  email: u.email,
  username: u.username,
  name: u.name,
  role: u.role,
  xp: u.xp,
  createdAt: { toDate: () => new Date(u.created_at) }
});

const mapTask = (t: any) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  deadline: { toDate: () => new Date(t.deadline) },
  maxXP: t.max_xp,
  assignedType: t.assigned_type,
  assignedUsers: t.assigned_users || [],
  createdById: t.created_by_id,
  createdAt: { toDate: () => new Date(t.created_at) },
  status: t.status,
  requiredFields: t.required_fields || ["textarea"]
});

const mapSubmission = (s: any) => ({
  id: s.id,
  taskId: s.task_id,
  taskTitle: s.task_title,
  userId: s.user_id,
  userName: s.user_name,
  userEmail: s.user_email,
  content: s.content,
  status: s.status,
  submittedAt: { toDate: () => new Date(s.submitted_at) },
  xpAwarded: s.xp_awarded,
  reviewedAt: s.reviewed_at ? { toDate: () => new Date(s.reviewed_at) } : null
});

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      const maxDim = 4000;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      const attemptBlob = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size <= 5 * 1024 * 1024 || quality <= 0.1) {
              const compressedFile = new File([blob], file.name.substring(0, file.name.lastIndexOf('.')) + ".jpg", {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              quality -= 0.15;
              width = Math.round(width * 0.9);
              height = Math.round(height * 0.9);
              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);
              attemptBlob();
            }
          },
          "image/jpeg",
          quality
        );
      };
      attemptBlob();
    };
    img.onerror = () => {
      resolve(file);
    };
  });
};

const renderSubmissionContent = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
          {parsed.text && (
            <div>
              <strong style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Short Answer</strong>
              <div style={{ background: "var(--bg-base)", padding: "0.5rem 0.75rem", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-color)", marginTop: "2px", color: "var(--text-primary)" }}>{parsed.text}</div>
            </div>
          )}
          {parsed.textarea && (
            <div>
              <strong style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Detailed Solution</strong>
              <div style={{ background: "var(--bg-base)", padding: "0.5rem 0.75rem", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-color)", marginTop: "2px", whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{parsed.textarea}</div>
            </div>
          )}
          {parsed.link && (
            <div>
              <strong style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Resource Link</strong>
              <div style={{ marginTop: "2px" }}>
                <a href={parsed.link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-hover)", textDecoration: "underline", wordBreak: "break-all", fontSize: "0.9rem" }}>
                  {parsed.link}
                </a>
              </div>
            </div>
          )}
          {parsed.upload && (
            <div>
              <strong style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Uploaded Attachment</strong>
              <div style={{ marginTop: "4px" }}>
                <a href={parsed.upload} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem", textDecoration: "none", fontSize: "0.8rem" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "block" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Download File
                </a>
              </div>
            </div>
          )}
        </div>
      );
    }
  } catch (e) {
    // legacy string submission
  }
  return <div style={{ whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>{content}</div>;
};

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onShowToast,
  currentUser,
  userProfile,
  onNavigateToAdmin,
}) => {
  // Navigation tabs: overview, tasks, history, leaderboard
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "history" | "leaderboard">("overview");

  const [submissionContent, setSubmissionContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activeSubmitTask, setActiveSubmitTask] = useState<any>(null);

  const [subText, setSubText] = useState("");
  const [subLink, setSubLink] = useState("");
  const [subFile, setSubFile] = useState<File | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // Real-time Lists
  const [leaderboardList, setLeaderboardList] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);

  // Derived rank
  const [userRank, setUserRank] = useState<number | string>("—");

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("xp", { ascending: false });

    if (error) {
      console.error("Error fetching leaderboard from Supabase:", error);
      return;
    }
    if (data) {
      const mapped = data.map(mapUser);
      setLeaderboardList(mapped);

      // Find current user's rank
      const index = mapped.findIndex((u: any) => u.uid === currentUser.uid);
      if (index !== -1) {
        setUserRank(index + 1);
      }
    }
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks from Supabase:", error);
      return;
    }
    if (data) {
      const mapped = data.map(mapTask);
      setAllTasks(mapped);
    }
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", currentUser.uid)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions from Supabase:", error);
      return;
    }
    if (data) {
      const mapped = data.map(mapSubmission);
      setMySubmissions(mapped);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTasks();
    fetchSubmissions();

    const usersChannel = supabase
      .channel("users-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchUsers)
      .subscribe();

    const tasksChannel = supabase
      .channel("tasks-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks)
      .subscribe();

    const submissionsChannel = supabase
      .channel("submissions-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, fetchSubmissions)
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(submissionsChannel);
    };
  }, [currentUser.uid]);

  // Handle task submission
  const handleTaskSubmit = async (e: React.FormEvent, task: any) => {
    e.preventDefault();

    const reqFields = task.requiredFields || ["textarea"];

    if (reqFields.includes("text") && !subText.trim()) {
      onShowToast("Please provide the required short answer.", "error");
      return;
    }
    if (reqFields.includes("textarea") && !submissionContent.trim()) {
      onShowToast("Please provide the required detailed solution.", "error");
      return;
    }
    if (reqFields.includes("link") && !subLink.trim()) {
      onShowToast("Please provide the required resource link.", "error");
      return;
    }
    if (reqFields.includes("upload") && !subFile) {
      onShowToast("Please attach the required file.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadUrl = "";
      if (reqFields.includes("upload") && subFile) {
        const fileExt = subFile.name.split('.').pop();
        const fileName = `${currentUser.uid}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("task-attachments")
          .upload(filePath, subFile);

        if (uploadErr) {
          throw new Error("File upload failed: " + uploadErr.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("task-attachments")
          .getPublicUrl(filePath);

        uploadUrl = publicUrlData.publicUrl;
      }

      const contentObj: Record<string, string> = {};
      if (reqFields.includes("text")) {
        contentObj.text = subText.trim();
      }
      if (reqFields.includes("textarea")) {
        contentObj.textarea = submissionContent.trim();
      }
      if (reqFields.includes("link")) {
        contentObj.link = subLink.trim();
      }
      if (reqFields.includes("upload") && uploadUrl) {
        contentObj.upload = uploadUrl;
      }

      const contentString = JSON.stringify(contentObj);

      const { error: insertErr } = await supabase.from("submissions").insert({
        task_id: task.id,
        task_title: task.title,
        user_id: currentUser.uid,
        user_name: userProfile?.name || "User",
        user_email: currentUser.email,
        content: contentString,
        status: "pending",
        submitted_at: new Date().toISOString(),
        xp_awarded: 0,
      });

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      onShowToast(`Submission for "${task.title}" uploaded! Waiting for approval.`, "success");
      setSubmissionContent("");
      setSubText("");
      setSubLink("");
      setSubFile(null);
      setIsSubmitModalOpen(false);
      setActiveSubmitTask(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Failed to submit task.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine the status of a task for the current user:
  // - "completed" if approved submission exists
  // - "pending" if pending submission exists
  // - "active" if no submission or only rejected submissions exist
  const getTaskStatusInfo = (taskId: string) => {
    const taskSubs = mySubmissions.filter((sub) => sub.taskId === taskId);
    if (taskSubs.some((sub) => sub.status === "approved")) {
      return { status: "completed", label: "Approved", class: "approved" };
    }
    if (taskSubs.some((sub) => sub.status === "pending")) {
      return { status: "pending", label: "Pending Approval", class: "pending" };
    }
    return { status: "active", label: "Active", class: "active" };
  };

  // Filter tasks that the user is assigned to
  const assignedTasks = allTasks.filter((task) => {
    if (task.assignedType === "all") return true;
    return task.assignedUsers?.includes(currentUser.uid);
  });

  const handleLogout = () => {
    authSignOut(auth);
  };

  return (
    <div className="app-wrapper">
      <header className="app-navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <ShinyText text="Sydions Portal" speed={3.5} />
          </div>
          <div className="brand-badge">User Workspace</div>
        </div>
        <div className="nav-user-info">
          <div className="nav-user-details">
            <div className="nav-user-name">{userProfile?.name || "Loading..."}</div>
            <div className="nav-user-role">{currentUser.email}</div>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        {/* Persistent Side Navigation */}
        <aside className="dashboard-sidebar">
          <div className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Overview Dashboard
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "tasks" ? "active" : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              My Assigned Tasks
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              Submission History
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "leaderboard" ? "active" : ""}`}
              onClick={() => setActiveTab("leaderboard")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Leaderboard
            </button>
            {userProfile?.role === "admin" && onNavigateToAdmin && (
              <button
                className="sidebar-nav-item"
                onClick={onNavigateToAdmin}
                style={{
                  color: "var(--primary-hover)",
                  fontWeight: "bold",
                  borderTop: "1px solid var(--border-color)",
                  marginTop: "0.5rem",
                  paddingTop: "0.75rem",
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Admin Panel
              </button>
            )}
          </div>

          <div className="sidebar-footer">
            <button className="btn btn-secondary btn-block btn-sm" onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "0.25rem" }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Selected Tab Subview Mount Point */}
        <main className="dashboard-main">
          {activeTab === "overview" && (
            <>
              {/* Profile Card Banner */}
              <div className="welcome-banner">
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                  <div className="profile-avatar-circle">
                    {(userProfile?.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="welcome-text">
                    <h2>
                      <BlurReveal text={`Welcome back, ${userProfile?.name || "User"}`} duration={0.8} />
                    </h2>
                    <p>Profile Account: {currentUser.email} | Rank Badge: #{typeof userRank === 'number' ? <CountUp to={userRank} duration={0.8} /> : userRank}</p>
                  </div>
                </div>
                <div className="profile-xp-total" style={{ fontSize: "1.1rem" }}>
                  Total Balance: <span style={{ color: "var(--accent-gold)", fontSize: "1.5rem", fontWeight: 700 }}><CountUp to={userProfile?.xp ?? 0} duration={1.2} suffix=" EXP" /></span>
                </div>
              </div>

              {/* Stats Strip */}
              <section className="stats-strip">
                <SpotlightCard className="stat-widget" spotlightColor="rgba(99, 102, 241, 0.12)">
                  <div className="stat-icon-wrapper primary-type">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">
                      <CountUp to={assignedTasks.filter((t) => getTaskStatusInfo(t.id).status === "active").length} duration={1.2} />
                    </span>
                    <span className="stat-label">Available Tasks</span>
                  </div>
                </SpotlightCard>

                <SpotlightCard className="stat-widget" spotlightColor="rgba(20, 184, 166, 0.12)">
                  <div className="stat-icon-wrapper secondary-type">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">
                      <CountUp to={mySubmissions.filter((s) => s.status === "approved").length} duration={1.2} />
                    </span>
                    <span className="stat-label">Completed Tasks</span>
                  </div>
                </SpotlightCard>

                <SpotlightCard className="stat-widget" spotlightColor="rgba(251, 191, 36, 0.12)">
                  <div className="stat-icon-wrapper" style={{ color: "var(--accent-gold)", backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.2)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">
                      <CountUp to={mySubmissions.filter((s) => s.status === "pending").length} duration={1.2} />
                    </span>
                    <span className="stat-label">Pending Approval</span>
                  </div>
                </SpotlightCard>
              </section>

              {/* Overview Columns */}
              <div style={{ marginTop: "2rem" }}>
                {/* Recent Submissions */}
                <SpotlightCard className="card" spotlightColor="rgba(99, 102, 241, 0.08)">
                  <div className="card-title-bar">
                    <div className="card-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 8v4l3 3" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                      Recent Activity
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {mySubmissions.length === 0 ? (
                      <div className="empty-placeholder">You haven't submitted any task solutions yet.</div>
                    ) : (
                      mySubmissions.slice(0, 4).map((sub) => (
                        <div key={sub.id} className="history-item-card" style={{ padding: "0.75rem 1rem" }}>
                          <div className="history-item-details">
                            <span className="history-task-title" style={{ fontSize: "0.875rem" }}>{sub.taskTitle}</span>
                            <span className="history-submission-date" style={{ fontSize: "0.7rem" }}>
                              {new Date(sub.submittedAt.toDate()).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="history-badge-block">
                            <span className={`status-capsule ${sub.status}`} style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                              {sub.status}
                            </span>
                            {sub.status === "approved" && (
                              <span className="xp-gained-value" style={{ fontSize: "0.8rem" }}>+{sub.xpAwarded} EXP</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SpotlightCard>
              </div>
            </>
          )}

          {activeTab === "tasks" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>My Assigned Tasks</div>
              </div>
              <p className="dashboard-view-desc">View and submit solutions for tasks assigned to you by the administration.</p>

              {assignedTasks.length === 0 ? (
                <div className="empty-placeholder">
                  No tasks assigned to your account at this time.
                </div>
              ) : (
                <div className="user-table-wrapper">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Deadline</th>
                        <th>Status</th>
                        <th>Reward</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedTasks.map((task) => {
                        const statusInfo = getTaskStatusInfo(task.id);
                        const isOverdue = new Date(task.deadline.toDate()) < new Date();
                        return (
                          <tr key={task.id}>
                            <td>
                              <strong>{task.title}</strong>
                            </td>
                            <td>
                              <span className={`task-deadline ${isOverdue ? "urgent" : "upcoming"}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                {new Date(task.deadline.toDate()).toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <span className={`status-capsule ${statusInfo.class}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td>
                              {task.assignedType === "all" ? (
                                <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{task.maxXP} EXP</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td>
                              {statusInfo.status === "active" ? (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setActiveSubmitTask(task);
                                    setIsSubmitModalOpen(true);
                                  }}
                                >
                                  Submit Solution
                                </button>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                  </svg>
                                  {statusInfo.status === "pending" ? "Pending" : "Completed"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Submission History</div>
              </div>
              <p className="dashboard-view-desc">Monitor the verification status of your task solutions and track earned EXP points.</p>

              {mySubmissions.length === 0 ? (
                <div className="empty-placeholder">You have not made any submissions yet.</div>
              ) : (
                <div className="user-table-wrapper">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Task Title</th>
                        <th>Submitted On</th>
                        <th>Status</th>
                        <th>EXP Gained</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubmissions.map((sub) => {
                        const isExpanded = expandedSubmissionId === sub.id;
                        return (
                          <React.Fragment key={sub.id}>
                            <tr
                              style={{ cursor: "pointer" }}
                              onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                            >
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    style={{
                                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                      transition: "transform 0.2s",
                                      color: "var(--text-muted)"
                                    }}
                                  >
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                  <strong>{sub.taskTitle}</strong>
                                </div>
                              </td>
                              <td>
                                <span style={{ color: "var(--text-muted)" }}>
                                  {new Date(sub.submittedAt.toDate()).toLocaleString()}
                                </span>
                              </td>
                              <td>
                                <span className={`status-capsule ${sub.status}`}>
                                  {sub.status}
                                </span>
                              </td>
                              <td>
                                {sub.status === "approved" ? (
                                  <span className="xp-gained-value" style={{ fontWeight: 700 }}>+{sub.xpAwarded} EXP</span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>-</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={4} style={{ backgroundColor: "rgba(255, 255, 255, 0.01)", padding: "1.25rem 1.5rem", borderTop: "none" }}>
                                  <div style={{ paddingLeft: "1.25rem", borderLeft: "2px solid var(--border-color)" }}>
                                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Your Submission Details</h4>
                                    {renderSubmissionContent(sub.content)}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === "leaderboard" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Platform Leaderboard</div>
              </div>
              <p className="dashboard-view-desc">Live ranking of all users based on earned EXP.</p>

              <div className="leaderboard-list" style={{ marginTop: '1.5rem' }}>
                {leaderboardList.length === 0 ? (
                  <div className="empty-placeholder">No user rankings yet.</div>
                ) : (
                  leaderboardList.map((user, idx) => {
                    const rank = idx + 1;
                    const isCurrentUser = user.uid === currentUser.uid;
                    return (
                      <div
                        key={user.uid}
                        className="leaderboard-item"
                        style={{
                          padding: '1.25rem 1.5rem',
                          background: isCurrentUser ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-base)',
                          border: isCurrentUser ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          borderRadius: 'var(--border-radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.75rem',
                          boxShadow: isCurrentUser ? '0 0 10px rgba(139, 92, 246, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                      >
                        <div className="leaderboard-profile-slot" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <span className={`rank-badge rank-${rank <= 3 ? rank : ""}`} style={{ fontSize: '1.2rem', minWidth: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {rank}
                          </span>
                          <div className="leaderboard-user-details" style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="leaderboard-user-name" style={{ fontSize: '1.1rem', fontWeight: 600, color: isCurrentUser ? 'var(--primary)' : 'var(--text-primary)' }}>
                              {user.name} {isCurrentUser && " (You)"}
                            </span>
                            <span className="leaderboard-user-email" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              @{user.username}
                            </span>
                          </div>
                        </div>
                        <div className="leaderboard-xp-badge" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-gold)', padding: '0.5rem 1rem', background: 'rgba(251,191,36,0.1)', borderRadius: 'var(--border-radius-full)' }}>
                          {user.xp} EXP
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Submit Solution Modal */}
      {isSubmitModalOpen && activeSubmitTask && (
        <div className="modal-overlay" onClick={() => {
          setIsSubmitModalOpen(false);
          setSubmissionContent("");
          setSubText("");
          setSubLink("");
          setSubFile(null);
        }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Submit Solution</div>
              <button type="button" className="modal-close-btn" onClick={() => {
                setIsSubmitModalOpen(false);
                setSubmissionContent("");
                setSubText("");
                setSubLink("");
                setSubFile(null);
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{activeSubmitTask.title}</strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{activeSubmitTask.description}</p>
              </div>
              <form onSubmit={(e) => handleTaskSubmit(e, activeSubmitTask)}>
                {(() => {
                  const reqFields = activeSubmitTask.requiredFields || ["textarea"];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {reqFields.includes("text") && (
                        <div className="form-group">
                          <label className="form-label">Short Answer</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Provide a brief summary or direct answer..."
                            value={subText}
                            onChange={(e) => setSubText(e.target.value)}
                            required
                          />
                        </div>
                      )}
                      
                      {reqFields.includes("textarea") && (
                        <div className="form-group">
                          <label className="form-label">Detailed Solution</label>
                          <textarea
                            className="form-control"
                            placeholder="Enter detailed step-by-step description of your solution..."
                            rows={4}
                            value={submissionContent}
                            onChange={(e) => setSubmissionContent(e.target.value)}
                            required
                          ></textarea>
                        </div>
                      )}
                      
                      {reqFields.includes("link") && (
                        <div className="form-group">
                          <label className="form-label">Resource Link (URL)</label>
                          <input
                            type="url"
                            className="form-control"
                            placeholder="https://example.com/project-link"
                            value={subLink}
                            onChange={(e) => setSubLink(e.target.value)}
                            required
                          />
                        </div>
                      )}
                      
                      {reqFields.includes("upload") && (
                        <div className="form-group">
                          <label className="form-label">Attach File (Max 5MB)</label>
                          <input
                            type="file"
                            className="form-control"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                if (file.type.startsWith("image/")) {
                                  onShowToast("Image exceeds 5MB. Auto-compressing...", "success");
                                  try {
                                    const compressed = await compressImage(file);
                                    if (compressed.size > 5 * 1024 * 1024) {
                                      onShowToast("Failed to compress image below 5MB.", "error");
                                      e.target.value = "";
                                      setSubFile(null);
                                    } else {
                                      setSubFile(compressed);
                                      onShowToast(`Image compressed successfully (${(compressed.size / (1024 * 1024)).toFixed(2)} MB)`, "success");
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    onShowToast("Error compressing image.", "error");
                                    e.target.value = "";
                                    setSubFile(null);
                                  }
                                } else {
                                  onShowToast("File exceeds 5MB size limit.", "error");
                                  e.target.value = "";
                                  setSubFile(null);
                                }
                              } else {
                                setSubFile(file);
                              }
                            }}
                            required={!subFile}
                          />
                          {subFile && (
                            <span style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "0.25rem", display: "inline-block" }}>
                              Selected: {subFile.name} ({(subFile.size / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsSubmitModalOpen(false);
                      setSubmissionContent("");
                      setSubText("");
                      setSubLink("");
                      setSubFile(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Send for Approval"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
