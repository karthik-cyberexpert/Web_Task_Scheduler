import React, { useState, useEffect } from "react";
import { signOut as authSignOut } from "firebase/auth";
import { auth } from "../firebase";
import { supabase } from "../supabaseClient";
import { SpotlightCard, ShinyText, CountUp, BlurReveal } from "./reactbits";
import { sendDeadlineReminder } from "../utils/email";


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
  exp: u.exp ?? 0,
  xp: u.xp ?? 0,
  isBanned: u.is_banned ?? false,
  banReason: u.ban_reason ?? "",
  suspendedUntil: u.suspended_until || null,
  dailyStreak: u.daily_streak ?? 0,
  lastClaimedAt: u.last_claimed_at ? new Date(u.last_claimed_at) : null,
  createdAt: { toDate: () => new Date(u.created_at) }
});

const mapTask = (t: any) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  deadline: { toDate: () => new Date(t.deadline) },
  maxXP: t.max_xp,
  xpReward: t.xp_reward ?? 0,
  assignedType: t.assigned_type,
  assignedUsers: t.assigned_users || [],
  createdById: t.created_by_id,
  createdAt: { toDate: () => new Date(t.created_at) },
  status: t.status,
  requiredFields: t.required_fields || ["textarea"],
  publishedAt: t.published_at ? { toDate: () => new Date(t.published_at) } : null
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
  levelXPAwarded: s.level_xp_awarded ?? 0,
  reviewedAt: s.reviewed_at ? { toDate: () => new Date(s.reviewed_at) } : null
});

const mapJob = (j: any) => ({
  id: j.id,
  title: j.title,
  description: j.description,
  deadline: { toDate: () => new Date(j.deadline) },
  xpReward: j.xp_reward,
  assignedType: j.assigned_type,
  assignedUsers: j.assigned_users || [],
  createdById: j.created_by_id,
  createdAt: { toDate: () => new Date(j.created_at) },
  status: j.status,
  requiredFields: j.required_fields || ["textarea"]
});

const mapJobSubmission = (js: any) => ({
  id: js.id,
  jobId: js.job_id,
  jobTitle: js.job_title,
  userId: js.user_id,
  userName: js.user_name,
  userEmail: js.user_email,
  content: js.content,
  status: js.status,
  submittedAt: { toDate: () => new Date(js.submitted_at) },
  xpAwarded: js.xp_awarded,
  reviewedAt: js.reviewed_at ? { toDate: () => new Date(js.reviewed_at) } : null
});

export const getAvatarGradient = (username: string) => {
  const gradients = [
    "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)", // indigo to cyan
    "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)", // pink to purple
    "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)", // emerald to blue
    "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)", // amber to red
    "linear-gradient(135deg, #84cc16 0%, #10b981 100%)", // lime to emerald
    "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", // cyan to blue
  ];
  let hash = 0;
  const str = username || "user";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

const SubmissionStarRating: React.FC<{
  currentRating: number;
  onRate: (rating: number) => void;
}> = ({ currentRating, onRate }) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Your Rating:</span>
      {[1, 2, 3, 4, 5].map((val) => {
        const isFilled = hoverRating !== null ? val <= hoverRating : val <= currentRating;
        return (
          <button
            key={val}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.1rem',
              color: isFilled ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontSize: '1.4rem',
              lineHeight: 1,
              transition: 'transform 0.1s ease',
              transform: hoverRating === val ? 'scale(1.25)' : 'none'
            }}
            onClick={() => onRate(val)}
            onMouseEnter={() => setHoverRating(val)}
            onMouseLeave={() => setHoverRating(null)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

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

const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const total = Math.max(1, totalPages);

  const getPages = () => {
    const pages: (number | string)[] = [];
    if (currentPage === 1) {
      pages.push(1);
      if (total >= 2) pages.push(2);
      if (total >= 3) pages.push(3);
      if (total > 4) pages.push("...");
      if (total >= 4) pages.push(total);
    } else if (currentPage === 2) {
      pages.push(1, 2);
      if (total >= 3) pages.push(3);
      if (total >= 4) pages.push(4);
      if (total > 5) pages.push("...");
      if (total >= 5) pages.push(total);
    } else {
      pages.push(1);
      pages.push("...");
      pages.push(currentPage);
      if (currentPage + 1 < total) {
        pages.push(currentPage + 1);
      }
      if (currentPage + 2 < total) {
        pages.push(currentPage + 2);
      }
      if (currentPage + 3 < total) {
        pages.push("...");
      }
      pages.push(total);
    }
    return pages;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '1.25rem', padding: '0.5rem 0' }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}
      >
        Prev
      </button>
      {getPages().map((pg, idx) => {
        if (pg === "...") {
          return (
            <span key={`ellipsis-${idx}`} style={{ color: 'var(--text-muted)', padding: '0 0.15rem', fontSize: '0.85rem' }}>
              ...
            </span>
          );
        }
        const isCurrent = pg === currentPage;
        return (
          <button
            key={`page-${pg}`}
            type="button"
            className={isCurrent ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            onClick={() => onPageChange(pg as number)}
            style={{
              minWidth: '1.75rem',
              height: '1.75rem',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: isCurrent ? 700 : 500,
              backgroundColor: isCurrent ? 'var(--primary)' : 'transparent',
              borderColor: isCurrent ? 'var(--primary)' : 'var(--border-color)',
              color: isCurrent ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {pg}
          </button>
        );
      })}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={currentPage === total}
        onClick={() => onPageChange(currentPage + 1)}
        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}
      >
        Next
      </button>
    </div>
  );
};

const checkStreak = (dailyStreak: number, lastClaimedAt: Date | null) => {
  if (!lastClaimedAt) {
    return {
      canClaim: true,
      nextDay: 1,
      isReset: false,
      xpReward: 5
    };
  }

  const now = new Date();
  
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const todayStr = getLocalDateString(now);
  const claimedStr = getLocalDateString(lastClaimedAt);

  if (todayStr === claimedStr) {
    return {
      canClaim: false,
      nextDay: (dailyStreak % 7) + 1,
      isReset: false,
      xpReward: 5 * Math.pow(2, dailyStreak % 7)
    };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (claimedStr === yesterdayStr) {
    const nextDay = (dailyStreak % 7) + 1;
    return {
      canClaim: true,
      nextDay,
      isReset: false,
      xpReward: 5 * Math.pow(2, nextDay - 1)
    };
  }

  return {
    canClaim: true,
    nextDay: 1,
    isReset: true,
    xpReward: 5
  };
};

const getXPForDay = (d: number) => {
  return 5 * Math.pow(2, d - 1);
};

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onShowToast,
  currentUser,
  userProfile,
  onNavigateToAdmin,
}) => {
  // Navigation tabs: overview, tasks, leaderboard, evaluate, jobs
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "leaderboard" | "evaluate" | "jobs">("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Daily Rewards state
  const [isDailyRewardOpen, setIsDailyRewardOpen] = useState(false);
  const [claimedXpRevealed, setClaimedXpRevealed] = useState<number | null>(null);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Levels state (fetched for profile progress)
  const [allLevels, setAllLevels] = useState<any[]>([]);

  // Level-up animation state
  const [levelUpAnim, setLevelUpAnim] = useState<{ fromLevel: string; toLevel: string } | null>(null);

  const fetchLevels = async () => {
    const { data, error } = await supabase
      .from("levels")
      .select("*")
      .order("min_xp", { ascending: true });
    if (!error && data) setAllLevels(data);
  };

  // Helper: Get current level info from XP
  const getCurrentLevelInfo = (xp: number, levels: any[]) => {
    if (!levels || levels.length === 0) return null;
    let currentLevel = levels[0];
    for (const lvl of levels) {
      if (xp >= lvl.min_xp) currentLevel = lvl;
    }
    const idx = levels.indexOf(currentLevel);
    const nextLevel = idx < levels.length - 1 ? levels[idx + 1] : null;
    const prevMin = currentLevel.min_xp;
    const progressMax = nextLevel ? nextLevel.min_xp - prevMin : currentLevel.max_xp - prevMin;
    const progressCurrent = Math.max(0, xp - prevMin);
    const pct = Math.min(100, Math.round((progressCurrent / Math.max(progressMax, 1)) * 100));
    return { currentLevel, nextLevel, progressCurrent, progressMax, pct };
  };

  // Level-up check: run after XP changes
  const checkAndTriggerLevelUp = async (prevXp: number, newXp: number, levels: any[]) => {
    if (!levels || levels.length === 0) return;
    const prevInfo = getCurrentLevelInfo(prevXp, levels);
    const newInfo = getCurrentLevelInfo(newXp, levels);
    if (
      prevInfo && newInfo &&
      prevInfo.currentLevel.id !== newInfo.currentLevel.id
    ) {
      setLevelUpAnim({
        fromLevel: prevInfo.currentLevel.level_name,
        toLevel: newInfo.currentLevel.level_name,
      });
      // Update level in users table
      await supabase
        .from("users")
        .update({ current_level_id: newInfo.currentLevel.id })
        .eq("uid", currentUser.uid);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setLevelUpAnim(null), 5000);
    }
  };

  // Dynamic calculations for streak
  const currentStreak = userProfile?.daily_streak ?? userProfile?.dailyStreak ?? 0;
  const lastClaimedVal = userProfile?.last_claimed_at ?? userProfile?.lastClaimedAt ?? null;
  const lastClaimedDate = lastClaimedVal ? new Date(lastClaimedVal) : null;
  const streakStatus = checkStreak(currentStreak, lastClaimedDate);

  const handleClaimDailyReward = async () => {
    if (!streakStatus.canClaim) {
      onShowToast("You have already claimed today's reward. Come back tomorrow!", "error");
      return;
    }

    setIsClaimingDaily(true);
    try {
      const nowStr = new Date().toISOString();
      const nextDay = streakStatus.nextDay;
      const xpEarned = getXPForDay(nextDay);

      // Fetch user's current XP first to be accurate
      const { data: userData, error: fetchErr } = await supabase
        .from("users")
        .select("xp")
        .eq("uid", currentUser.uid)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const currentXp = userData?.xp || 0;
      const newXp = currentXp + xpEarned;

      const { error: updateErr } = await supabase
        .from("users")
        .update({
          xp: newXp,
          daily_streak: nextDay,
          last_claimed_at: nowStr
        })
        .eq("uid", currentUser.uid);

      if (updateErr) throw updateErr;

      // Check if user leveled up
      const levelsSnap = allLevels.length > 0 ? allLevels : [];
      if (levelsSnap.length > 0) {
        await checkAndTriggerLevelUp(currentXp, newXp, levelsSnap);
      }

      // Set revealed XP locally for the success animation
      setClaimedXpRevealed(xpEarned);
      onShowToast(`Successfully claimed Day ${nextDay} Daily Reward: +${xpEarned} XP!`, "success");
    } catch (err: any) {
      console.error("Claim daily reward error:", err);
      onShowToast(err.message || "Failed to claim daily reward.", "error");
    } finally {
      setIsClaimingDaily(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchTasks(),
        fetchSubmissions(),
        fetchEvaluations(),
        fetchJobs(),
        fetchJobSubmissions()
      ]);
      onShowToast("Dashboard data refreshed!", "success");
    } catch (err: any) {
      console.error("Refresh error:", err);
      onShowToast("Failed to refresh data.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };
  const [evaluateSubmissions, setEvaluateSubmissions] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [historyRatings, setHistoryRatings] = useState<any[]>([]);
  const [expandedEvaluateId, setExpandedEvaluateId] = useState<string | null>(null);

  // Pagination pages
  const [tasksPage, setTasksPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [evaluatePage, setEvaluatePage] = useState(1);

  const [submissionContent, setSubmissionContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activeSubmitTask, setActiveSubmitTask] = useState<any>(null);
  const [viewingDescription, setViewingDescription] = useState<string | null>(null);

  const [subText, setSubText] = useState("");
  const [subLink, setSubLink] = useState("");
  const [subFile, setSubFile] = useState<File | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // Jobs states
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [myJobSubmissions, setMyJobSubmissions] = useState<any[]>([]);
  const [isJobSubmitModalOpen, setIsJobSubmitModalOpen] = useState(false);
  const [activeSubmitJob, setActiveSubmitJob] = useState<any>(null);
  const [jobSubText, setJobSubText] = useState("");
  const [jobSubmissionContent, setJobSubmissionContent] = useState("");
  const [jobSubLink, setJobSubLink] = useState("");
  const [jobSubFile, setJobSubFile] = useState<File | null>(null);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsHistoryPage, setJobsHistoryPage] = useState(1);
  const [activeJobSubTab, setActiveJobSubTab] = useState<"active" | "pending" | "approved" | "rejected">("active");
  const [activeTaskSubTab, setActiveTaskSubTab] = useState<"active" | "pending" | "approved" | "rejected">("active");

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
      .order("exp", { ascending: false });

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

      if (mapped.length > 0) {
        const subIds = mapped.map((s: any) => s.id);
        const { data: ratingsData, error: ratingsError } = await supabase
          .from("submission_ratings")
          .select("*")
          .in("submission_id", subIds);
        if (!ratingsError && ratingsData) {
          setHistoryRatings(ratingsData);
        } else {
          setHistoryRatings([]);
        }
      } else {
        setHistoryRatings([]);
      }
    }
  };

  const fetchEvaluations = async () => {
    setIsEvaluating(true);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .not("published_at", "is", null)
        .gt("published_at", twentyFourHoursAgo);

      if (tasksError) throw tasksError;

      const mappedTasks = (tasksData || []).map(mapTask);
      const publishedTaskIds = mappedTasks.map(t => t.id);
      if (publishedTaskIds.length > 0) {
        const { data: subsData, error: subsError } = await supabase
          .from("submissions")
          .select("*")
          .in("task_id", publishedTaskIds)
          .eq("status", "approved")
          .neq("user_id", currentUser.uid);

        if (subsError) throw subsError;
        setEvaluateSubmissions((subsData || []).map(mapSubmission));
      } else {
        setEvaluateSubmissions([]);
      }

      const { data: ratingsData, error: ratingsError } = await supabase
        .from("submission_ratings")
        .select("*")
        .eq("rater_id", currentUser.uid);

      if (ratingsError) throw ratingsError;
      setUserRatings(ratingsData || []);
    } catch (err) {
      console.error("Error fetching evaluations data:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRateSubmission = async (submissionId: string, ratingValue: number) => {
    try {
      const { error } = await supabase
        .from("submission_ratings")
        .upsert({
          submission_id: submissionId,
          rater_id: currentUser.uid,
          rating: ratingValue,
          rated_at: new Date().toISOString()
        }, { onConflict: "submission_id,rater_id" });

      if (error) throw error;
      onShowToast("Submission rated successfully!", "success");
      fetchEvaluations();
    } catch (err: any) {
      console.error("Error rating submission:", err);
      onShowToast(err.message || "Failed to submit rating.", "error");
    }
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching jobs from Supabase:", error);
      return;
    }
    if (data) {
      setAllJobs(data.map(mapJob));
    }
  };

  const fetchJobSubmissions = async () => {
    const { data, error } = await supabase
      .from("job_submissions")
      .select("*")
      .eq("user_id", currentUser.uid)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching job submissions from Supabase:", error);
      return;
    }
    if (data) {
      setMyJobSubmissions(data.map(mapJobSubmission));
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTasks();
    fetchSubmissions();
    fetchEvaluations();
    fetchJobs();
    fetchJobSubmissions();
    fetchLevels();

    const usersChannel = supabase
      .channel("users-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchUsers)
      .subscribe();

    const tasksChannel = supabase
      .channel("tasks-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
        fetchEvaluations();
      })
      .subscribe();

    const submissionsChannel = supabase
      .channel("submissions-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        fetchSubmissions();
        fetchEvaluations();
      })
      .subscribe();

    const ratingsChannel = supabase
      .channel("ratings-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "submission_ratings" }, () => {
        fetchEvaluations();
        fetchSubmissions();
      })
      .subscribe();

    const jobsChannel = supabase
      .channel("jobs-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, fetchJobs)
      .subscribe();

    const jobSubmissionsChannel = supabase
      .channel("job-submissions-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_submissions" }, () => {
        fetchJobSubmissions();
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(submissionsChannel);
      supabase.removeChannel(ratingsChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(jobSubmissionsChannel);
    };
  }, [currentUser.uid]);

  // Hook to check for and trigger approaching task deadline emails
  useEffect(() => {
    if (!currentUser?.uid || allTasks.length === 0) return;

    const checkDeadlineReminders = async () => {
      const now = new Date();
      
      // Filter tasks assigned to current user
      const userTasks = allTasks.filter((task) => {
        if (task.assignedType === "all") {
          if (task.assignedUsers && task.assignedUsers.length > 0) {
            return task.assignedUsers.includes(currentUser.uid);
          }
          return true;
        }
        return task.assignedUsers?.includes(currentUser.uid);
      });

      for (const task of userTasks) {
        // Check if user has already submitted (approved or pending)
        const hasSubmitted = mySubmissions.some(
          (sub) => sub.taskId === task.id && (sub.status === "approved" || sub.status === "pending")
        );
        if (hasSubmitted) continue;

        const deadlineDate = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
        const msRemaining = deadlineDate.getTime() - now.getTime();
        const hoursRemaining = msRemaining / (1000 * 60 * 60);

        // 'before_day' reminder: deadline is tomorrow (between 24 and 48 hours away)
        // 'on_day' reminder: deadline is today (within 24 hours)
        let reminderType: "before_day" | "on_day" | null = null;
        if (hoursRemaining > 0 && hoursRemaining <= 24) {
          reminderType = "on_day";
        } else if (hoursRemaining > 24 && hoursRemaining <= 48) {
          reminderType = "before_day";
        }

        if (!reminderType) continue;

        try {
          // Check if this specific reminder has already been sent
          const { data: sentList, error: checkError } = await supabase
            .from("sent_reminders")
            .select("id")
            .eq("task_id", task.id)
            .eq("user_id", currentUser.uid)
            .eq("reminder_type", reminderType);

          if (checkError) {
            console.error("Error checking sent reminders:", checkError);
            continue;
          }

          if (sentList && sentList.length > 0) {
            continue;
          }

          // Queue the reminder email
          const emailRes = await sendDeadlineReminder({
            toEmail: currentUser.email,
            toName: userProfile?.name || currentUser.email,
            taskTitle: task.title,
            taskDeadline: deadlineDate.toLocaleString(),
            reminderType,
          });

          if (emailRes.success) {
            // Log that the reminder has been sent
            const { error: insertError } = await supabase
              .from("sent_reminders")
              .insert({
                task_id: task.id,
                user_id: currentUser.uid,
                reminder_type: reminderType,
              });

            if (insertError) {
              console.error("Error recording sent reminder:", insertError);
            }
          }
        } catch (err) {
          console.error("Error checking/sending deadline reminder:", err);
        }
      }
    };

    checkDeadlineReminders();
  }, [allTasks, mySubmissions, currentUser, userProfile]);

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

      const existingSub = mySubmissions.find((sub) => sub.taskId === task.id);
      
      let insertErr;
      if (existingSub) {
        if (existingSub.xpAwarded > 0 || existingSub.levelXPAwarded > 0) {
          const { data: userData, error: fetchErr } = await supabase
            .from("users")
            .select("exp, xp")
            .eq("uid", currentUser.uid)
            .maybeSingle();

          if (fetchErr) throw new Error(fetchErr.message);

          const currentExp = userData?.exp || 0;
          const currentXp = userData?.xp || 0;
          const newExp = Math.max(0, currentExp - existingSub.xpAwarded);
          const newXp = Math.max(0, currentXp - existingSub.levelXPAwarded);

          const { error: userErr } = await supabase
            .from("users")
            .update({ 
              exp: newExp,
              xp: newXp
            })
            .eq("uid", currentUser.uid);

          if (userErr) throw new Error(userErr.message);
        }

        const { error } = await supabase.from("submissions").update({
          content: contentString,
          status: "pending",
          xp_awarded: 0,
          level_xp_awarded: 0,
          submitted_at: new Date().toISOString(),
        }).eq("id", existingSub.id);
        insertErr = error;
      } else {
        const { error } = await supabase.from("submissions").insert({
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
        insertErr = error;
      }

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      await fetchSubmissions();

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

  const handleJobSubmit = async (e: React.FormEvent, job: any) => {
    e.preventDefault();

    const reqFields = job.requiredFields || ["textarea"];

    if (reqFields.includes("text") && !jobSubText.trim()) {
      onShowToast("Please provide the required short answer.", "error");
      return;
    }
    if (reqFields.includes("textarea") && !jobSubmissionContent.trim()) {
      onShowToast("Please provide the required detailed solution.", "error");
      return;
    }
    if (reqFields.includes("link") && !jobSubLink.trim()) {
      onShowToast("Please provide the required resource link.", "error");
      return;
    }
    if (reqFields.includes("upload") && !jobSubFile) {
      onShowToast("Please attach the required file.", "error");
      return;
    }

    setJobSubmitting(true);
    try {
      let uploadUrl = "";
      if (reqFields.includes("upload") && jobSubFile) {
        const fileExt = jobSubFile.name.split('.').pop();
        const fileName = `job-${currentUser.uid}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("task-attachments")
          .upload(filePath, jobSubFile);

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
        contentObj.text = jobSubText.trim();
      }
      if (reqFields.includes("textarea")) {
        contentObj.textarea = jobSubmissionContent.trim();
      }
      if (reqFields.includes("link")) {
        contentObj.link = jobSubLink.trim();
      }
      if (reqFields.includes("upload") && uploadUrl) {
        contentObj.upload = uploadUrl;
      }

      const contentString = JSON.stringify(contentObj);

      const existingSub = myJobSubmissions.find((sub) => sub.jobId === job.id);
      
      let insertErr;
      if (existingSub) {
        if (existingSub.xpAwarded > 0) {
          const { data: userData, error: fetchErr } = await supabase
            .from("users")
            .select("xp")
            .eq("uid", currentUser.uid)
            .maybeSingle();

          if (fetchErr) throw new Error(fetchErr.message);

          const currentXp = userData?.xp || 0;
          const newXp = Math.max(0, currentXp - existingSub.xpAwarded);

          const { error: userErr } = await supabase
            .from("users")
            .update({ xp: newXp })
            .eq("uid", currentUser.uid);

          if (userErr) throw new Error(userErr.message);
        }

        const { error } = await supabase.from("job_submissions").update({
          content: contentString,
          status: "pending",
          xp_awarded: 0,
          submitted_at: new Date().toISOString(),
        }).eq("id", existingSub.id);
        insertErr = error;
      } else {
        const { error } = await supabase.from("job_submissions").insert({
          job_id: job.id,
          job_title: job.title,
          user_id: currentUser.uid,
          user_name: userProfile?.name || "User",
          user_email: currentUser.email,
          content: contentString,
          status: "pending",
          submitted_at: new Date().toISOString(),
          xp_awarded: 0,
        });
        insertErr = error;
      }

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      await fetchJobSubmissions();

      onShowToast(`Submission for "${job.title}" uploaded! Waiting for approval.`, "success");
      setJobSubmissionContent("");
      setJobSubText("");
      setJobSubLink("");
      setJobSubFile(null);
      setIsJobSubmitModalOpen(false);
      setActiveSubmitJob(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Failed to submit job.", "error");
    } finally {
      setJobSubmitting(false);
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

  const getJobStatusInfo = (jobId: string) => {
    const jobSubs = myJobSubmissions.filter((sub) => sub.jobId === jobId);
    if (jobSubs.some((sub) => sub.status === "approved")) {
      return { status: "completed", label: "Approved", class: "approved" };
    }
    if (jobSubs.some((sub) => sub.status === "pending")) {
      return { status: "pending", label: "Pending Approval", class: "pending" };
    }
    if (jobSubs.some((sub) => sub.status === "rejected")) {
      return { status: "rejected", label: "Rejected", class: "rejected" };
    }
    return { status: "active", label: "Active", class: "active" };
  };

  const assignedJobs = allJobs.filter((job) => {
    if (job.status !== "active") return false;
    if (job.assignedType === "all") {
      if (job.assignedUsers && job.assignedUsers.length > 0) {
        return job.assignedUsers.includes(currentUser.uid);
      }
      return true;
    }
    return job.assignedUsers?.includes(currentUser.uid);
  });

  // Filter tasks that the user is assigned to
  const assignedTasks = allTasks.filter((task) => {
    if (task.assignedType === "all") {
      if (task.assignedUsers && task.assignedUsers.length > 0) {
        return task.assignedUsers.includes(currentUser.uid);
      }
      return true;
    }
    return task.assignedUsers?.includes(currentUser.uid);
  });

  // Filter tasks into Active, Pending, Approved, and Rejected/Expired categories
  const activeTasks = assignedTasks.filter((task) => {
    const sub = mySubmissions.find((s) => s.taskId === task.id);
    const isOverdue = new Date(task.deadline.toDate()) < new Date();
    return !sub && !isOverdue;
  });

  const pendingTasksHistory = mySubmissions
    .filter((sub) => sub.status === "pending")
    .map((sub) => ({
      id: sub.id,
      taskTitle: sub.taskTitle,
      submittedAt: sub.submittedAt,
      status: sub.status,
      xpAwarded: sub.xpAwarded,
      levelXPAwarded: sub.levelXPAwarded,
      task: allTasks.find((t) => t.id === sub.taskId),
      submission: sub,
      isExpired: false,
    }))
    .sort((a, b) => b.submittedAt.toDate().getTime() - a.submittedAt.toDate().getTime());

  const approvedTasksHistory = mySubmissions
    .filter((sub) => sub.status === "approved")
    .map((sub) => ({
      id: sub.id,
      taskTitle: sub.taskTitle,
      submittedAt: sub.submittedAt,
      status: sub.status,
      xpAwarded: sub.xpAwarded,
      levelXPAwarded: sub.levelXPAwarded,
      task: allTasks.find((t) => t.id === sub.taskId),
      submission: sub,
      isExpired: false,
    }))
    .sort((a, b) => b.submittedAt.toDate().getTime() - a.submittedAt.toDate().getTime());

  const rejectedTasksHistory = [
    ...mySubmissions.filter((sub) => sub.status === "rejected").map((sub) => ({
      id: sub.id,
      taskTitle: sub.taskTitle,
      submittedAt: sub.submittedAt,
      status: sub.status,
      xpAwarded: sub.xpAwarded,
      levelXPAwarded: sub.levelXPAwarded,
      task: allTasks.find((t) => t.id === sub.taskId),
      submission: sub,
      isExpired: false,
    })),
    ...assignedTasks.filter((task) => {
      const sub = mySubmissions.find((s) => s.taskId === task.id);
      const isOverdue = new Date(task.deadline.toDate()) < new Date();
      return !sub && isOverdue;
    }).map((task) => ({
      id: `expired-${task.id}`,
      taskTitle: task.title,
      submittedAt: task.deadline,
      status: "expired",
      xpAwarded: 0,
      levelXPAwarded: 0,
      task: task,
      submission: null,
      isExpired: true,
    }))
  ].sort((a, b) => b.submittedAt.toDate().getTime() - a.submittedAt.toDate().getTime());

  // Filter jobs into Active, Pending, Approved, and Rejected/Expired categories
  const activeJobs = assignedJobs.filter((job) => {
    const sub = myJobSubmissions.find((s) => s.jobId === job.id);
    const isOverdue = new Date(job.deadline.toDate()) < new Date();
    return !sub && !isOverdue;
  });

  const pendingJobsHistory = myJobSubmissions
    .filter((sub) => sub.status === "pending")
    .map((sub) => ({
      id: sub.id,
      jobTitle: sub.jobTitle || allJobs.find((j) => j.id === sub.jobId)?.title || "Job Solution",
      submittedAt: sub.submittedAt,
      status: sub.status,
      xpAwarded: sub.xpAwarded,
      job: allJobs.find((j) => j.id === sub.jobId),
      submission: sub,
      isExpired: false,
    }))
    .sort((a, b) => b.submittedAt.toDate().getTime() - a.submittedAt.toDate().getTime());

  const approvedJobsHistory = myJobSubmissions
    .filter((sub) => sub.status === "approved")
    .map((sub) => ({
      id: sub.id,
      jobTitle: sub.jobTitle || allJobs.find((j) => j.id === sub.jobId)?.title || "Job Solution",
      submittedAt: sub.submittedAt,
      status: sub.status,
      xpAwarded: sub.xpAwarded,
      job: allJobs.find((j) => j.id === sub.jobId),
      submission: sub,
      isExpired: false,
    }))
    .sort((a, b) => b.submittedAt.toDate().getTime() - a.submittedAt.toDate().getTime());

  const rejectedJobsHistory = [
    ...myJobSubmissions.filter((sub) => sub.status === "rejected").map((sub) => ({
      id: sub.id,
      jobTitle: sub.jobTitle || allJobs.find((j) => j.id === sub.jobId)?.title || "Job Solution",
      submittedAt: sub.submittedAt,
      status: sub.status,
      xpAwarded: sub.xpAwarded,
      job: allJobs.find((j) => j.id === sub.jobId),
      submission: sub,
      isExpired: false,
    })),
    ...assignedJobs.filter((job) => {
      const sub = myJobSubmissions.find((s) => s.jobId === job.id);
      const isOverdue = new Date(job.deadline.toDate()) < new Date();
      return !sub && isOverdue;
    }).map((job) => ({
      id: `expired-${job.id}`,
      jobTitle: job.title,
      submittedAt: job.deadline,
      status: "expired",
      xpAwarded: 0,
      job: job,
      submission: null,
      isExpired: true,
    }))
  ].sort((a, b) => b.submittedAt.toDate().getTime() - a.submittedAt.toDate().getTime());

  const handleLogout = () => {
    authSignOut(auth);
  };

  return (
    <div className="app-wrapper">
      <header className="app-navbar">
        <div className="brand-section">
          <button 
            className="hamburger-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {isMobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
          <div className="brand-logo">
            <ShinyText text="Sydions Portal" speed={3.5} />
          </div>
          <div className="brand-badge">User Workspace</div>
        </div>
        <div className="nav-user-info">
          <button
            type="button"
            className="daily-reward-btn"
            title="Daily Rewards"
            onClick={() => {
              setClaimedXpRevealed(null);
              setIsDailyRewardOpen(true);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
            {streakStatus.canClaim && <span className="pulse-dot" />}
          </button>
          <button
            type="button"
            className="action-icon-btn edit-btn"
            style={{ 
              marginRight: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
            }}
            title="Refresh Data"
            disabled={isRefreshing}
            onClick={handleRefresh}
            onMouseEnter={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }
            }}
          >
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <div className="nav-user-details">
            <div className="nav-user-name">{userProfile?.name || "Loading..."}</div>
            <div className="nav-user-role">{currentUser.email}</div>
          </div>
          {/* Profile avatar button */}
          <button
            type="button"
            title="View Profile"
            onClick={() => setIsProfileModalOpen(true)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '2px solid var(--primary)',
              background: getAvatarGradient(userProfile?.username || currentUser.email),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: '#fff',
              flexShrink: 0,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 0 0 0 var(--primary-glow)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 0 12px var(--primary-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 0 0 var(--primary-glow)';
            }}
          >
            {getInitials(userProfile?.name || currentUser.email)}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="dashboard-layout">
        {/* Persistent Side Navigation */}
        <aside className={`dashboard-sidebar ${isMobileMenuOpen ? "open" : ""}`}>
          <div className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("overview");
                setIsMobileMenuOpen(false);
              }}
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
              onClick={() => {
                setActiveTab("tasks");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Tasks
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "evaluate" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("evaluate");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Evaluate Submissions
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "jobs" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("jobs");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Jobs
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "leaderboard" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("leaderboard");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Leaderboard
            </button>
            {userProfile?.role === "admin" && onNavigateToAdmin && (
              <button
                className="sidebar-nav-item"
                onClick={() => {
                  onNavigateToAdmin();
                  setIsMobileMenuOpen(false);
                }}
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
            <button className="btn btn-secondary btn-block btn-sm" onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }}>
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
                    <p className="welcome-subtitle">
                      <span className="subtitle-email">Profile Account: {currentUser.email}</span>
                      <span className="subtitle-divider"> | </span>
                      <span className="subtitle-rank">Rank Badge: #{typeof userRank === 'number' ? <CountUp to={userRank} duration={0.8} /> : userRank}</span>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                  <div className="profile-xp-total" style={{ fontSize: "0.95rem" }}>
                    Task Balance: <span style={{ color: "var(--primary-hover)", fontSize: "1.35rem", fontWeight: 700 }}><CountUp to={userProfile?.exp ?? 0} duration={1.2} suffix=" EXP" /></span>
                  </div>
                  <div className="profile-xp-total" style={{ fontSize: "0.95rem" }}>
                    Leveling Points: <span style={{ color: "var(--accent-gold)", fontSize: "1.35rem", fontWeight: 700 }}><CountUp to={userProfile?.xp ?? 0} duration={1.2} suffix=" XP" /></span>
                  </div>
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
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span className="xp-gained-value" style={{ fontSize: "0.8rem" }}>+{sub.xpAwarded} EXP</span>
                                {sub.levelXPAwarded > 0 && (
                                  <span className="xp-gained-value" style={{ fontSize: "0.7rem", color: "var(--accent-gold)" }}>+{sub.levelXPAwarded} XP</span>
                                )}
                              </div>
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
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Tasks</div>
              </div>
              <p className="dashboard-view-desc">View and submit solutions for tasks assigned to you by the administration.</p>

              {/* Subtabs for Tasks */}
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTaskSubTab === "active" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTaskSubTab === "active" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveTaskSubTab("active"); setTasksPage(1); }}
                >
                  Active Tasks ({activeTasks.length})
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTaskSubTab === "pending" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTaskSubTab === "pending" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveTaskSubTab("pending"); setHistoryPage(1); }}
                >
                  Pending History ({pendingTasksHistory.length})
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTaskSubTab === "approved" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTaskSubTab === "approved" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveTaskSubTab("approved"); setHistoryPage(1); }}
                >
                  Approved History ({approvedTasksHistory.length})
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTaskSubTab === "rejected" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTaskSubTab === "rejected" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveTaskSubTab("rejected"); setHistoryPage(1); }}
                >
                  Rejected History ({rejectedTasksHistory.length})
                </button>
              </div>

              {activeTaskSubTab === "active" && (
                activeTasks.length === 0 ? (
                  <div className="empty-placeholder">
                    No active tasks assigned to your account at this time.
                  </div>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalTasksPages = Math.ceil(activeTasks.length / ITEMS_PER_PAGE);
                  const currentTasksPage = Math.min(tasksPage, Math.max(1, totalTasksPages));
                  const paginatedTasks = activeTasks.slice((currentTasksPage - 1) * ITEMS_PER_PAGE, currentTasksPage * ITEMS_PER_PAGE);
                  return (
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
                          {paginatedTasks.map((task) => {
                            const statusInfo = getTaskStatusInfo(task.id);
                            const isOverdue = new Date(task.deadline.toDate()) < new Date();
                            return (
                              <tr key={task.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong>{task.title}</strong>
                                    {task.description && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                                        title="View Description"
                                        onClick={() => setViewingDescription(task.description)}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                          <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                      </button>
                                    )}
                                  </div>
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
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ color: 'var(--primary-hover)', fontWeight: 600, fontSize: '0.85rem' }}>{task.maxXP} EXP</span>
                                    {task.xpReward > 0 && (
                                      <span style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '0.75rem' }}>+{task.xpReward} XP</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                      setActiveSubmitTask(task);
                                      setIsSubmitModalOpen(true);
                                    }}
                                  >
                                    Submit Solution
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <Pagination currentPage={currentTasksPage} totalPages={totalTasksPages} onPageChange={setTasksPage} />
                    </div>
                  );
                })()
              )}

              {activeTaskSubTab !== "active" && (() => {
                const subtabItems = 
                  activeTaskSubTab === "pending" ? pendingTasksHistory :
                  activeTaskSubTab === "approved" ? approvedTasksHistory :
                  rejectedTasksHistory;

                return subtabItems.length === 0 ? (
                  <div className="empty-placeholder">
                    {activeTaskSubTab === "pending" ? "No pending task submissions found." :
                     activeTaskSubTab === "approved" ? "No approved task submissions found." :
                     "No rejected or expired tasks found."}
                  </div>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalHistoryPages = Math.ceil(subtabItems.length / ITEMS_PER_PAGE);
                  const currentHistoryPage = Math.min(historyPage, Math.max(1, totalHistoryPages));
                  const paginatedItems = subtabItems.slice((currentHistoryPage - 1) * ITEMS_PER_PAGE, currentHistoryPage * ITEMS_PER_PAGE);
                  return (
                    <div className="user-table-wrapper">
                      <table className="user-table">
                        <thead>
                          <tr>
                            <th>Task Title</th>
                            <th>{activeTaskSubTab === "rejected" ? "Submitted/Deadline" : "Submitted On"}</th>
                            <th>Status</th>
                            {activeTaskSubTab === "approved" && <th>Avg Rating</th>}
                            <th>{activeTaskSubTab === "approved" ? "EXP Gained" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedItems.map((item) => {
                            const isExpanded = expandedSubmissionId === item.id;
                            const isOverdue = item.task ? new Date(item.task.deadline.toDate()) < new Date() : true;
                            
                            // Ratings info
                            const subRatings = item.submission ? historyRatings.filter((r: any) => r.submission_id === item.submission.id) : [];
                            const totalRating = subRatings.reduce((sum: number, r: any) => sum + r.rating, 0);
                            const ratingCount = subRatings.length;
                            const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : "—";

                            return (
                              <React.Fragment key={item.id}>
                                <tr
                                  style={{ cursor: item.submission ? "pointer" : "default" }}
                                  onClick={() => {
                                    if (item.submission) {
                                      setExpandedSubmissionId(isExpanded ? null : item.id);
                                    }
                                  }}
                                >
                                  <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      {item.submission && (
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
                                      )}
                                      <strong>{item.taskTitle}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ color: "var(--text-muted)" }}>
                                      {new Date(item.submittedAt.toDate()).toLocaleString()}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-capsule ${item.status}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  {activeTaskSubTab === "approved" && (
                                    <td>
                                      {ratingCount > 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                          <span style={{ color: 'var(--accent-gold)' }}>★</span>
                                          <span>{avgRating}</span>
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({ratingCount} {ratingCount === 1 ? 'user' : 'users'})</span>
                                        </div>
                                      ) : (
                                        <span style={{ color: "var(--text-muted)" }}>—</span>
                                      )}
                                    </td>
                                  )}
                                  <td>
                                    {activeTaskSubTab === "approved" ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span className="xp-gained-value" style={{ fontWeight: 700 }}>+{item.xpAwarded} EXP</span>
                                        {item.levelXPAwarded > 0 && (
                                          <span className="xp-gained-value" style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent-gold)' }}>+{item.levelXPAwarded} XP</span>
                                        )}
                                      </div>
                                    ) : (
                                      !isOverdue ? (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.submission) {
                                              try {
                                                const parsed = JSON.parse(item.submission.content);
                                                setSubText(parsed.text || "");
                                                setSubmissionContent(parsed.textarea || "");
                                                setSubLink(parsed.link || "");
                                              } catch(err) {}
                                            }
                                            setActiveSubmitTask(item.task);
                                            setIsSubmitModalOpen(true);
                                          }}
                                        >
                                          {item.submission ? "Edit Solution" : "Submit Solution"}
                                        </button>
                                      ) : (
                                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Expired</span>
                                      )
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && item.submission && (
                                  <tr>
                                    <td colSpan={activeTaskSubTab === "approved" ? 5 : 4} style={{ backgroundColor: "rgba(255, 255, 255, 0.01)", padding: "1.25rem 1.5rem", borderTop: "none" }}>
                                      <div style={{ paddingLeft: "1.25rem", borderLeft: "2px solid var(--border-color)" }}>
                                        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Your Submission Details</h4>
                                        {renderSubmissionContent(item.submission.content)}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                      <Pagination currentPage={currentHistoryPage} totalPages={totalHistoryPages} onPageChange={setHistoryPage} />
                    </div>
                  );
                })()
              })()}
            </>
          )}

          {activeTab === "leaderboard" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Platform Leaderboard</div>
              </div>
              <p className="dashboard-view-desc">Live ranking of all users based on earned EXP.</p>
              {leaderboardList.length === 0 ? (
                <div className="empty-placeholder" style={{ marginTop: '1.5rem' }}>No user rankings yet.</div>
              ) : (
                (() => {
                  const top3 = leaderboardList.slice(0, 3);
                  const remainingUsers = leaderboardList.slice(3);
                  const firstUser = top3[0];
                  const secondUser = top3[1];
                  const thirdUser = top3[2];

                  return (
                    <div className="leaderboard-container">
                      {top3.length > 0 && (
                        <div className="leaderboard-podium">
                          {/* 2nd Place */}
                          {secondUser && (
                            <div className={`podium-slot rank-2 ${secondUser.uid === currentUser.uid ? 'is-current-user' : ''}`}>
                              <div className="podium-avatar-container">
                                <div className="podium-avatar" style={{ background: getAvatarGradient(secondUser.username) }}>
                                  {getInitials(secondUser.name)}
                                </div>
                                <div className="podium-avatar-badge">2</div>
                              </div>
                              <div className="podium-user-name" title={secondUser.name}>
                                {secondUser.name} {secondUser.uid === currentUser.uid && " (You)"}
                              </div>
                              <div className="podium-user-username">@{secondUser.username}</div>
                              <div className="podium-xp-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '12px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--primary-hover)', fontWeight: 'bold' }}>{secondUser.exp} EXP</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{secondUser.xp} XP</span>
                              </div>
                            </div>
                          )}

                          {/* 1st Place */}
                          {firstUser && (
                            <div className={`podium-slot rank-1 ${firstUser.uid === currentUser.uid ? 'is-current-user' : ''}`}>
                              <div className="crown-container">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                                  <path d="M5 16L3 5l5 5 4-7 4 7 5-5-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                                </svg>
                              </div>
                              <div className="podium-avatar-container">
                                <div className="podium-avatar" style={{ background: getAvatarGradient(firstUser.username) }}>
                                  {getInitials(firstUser.name)}
                                </div>
                                <div className="podium-avatar-badge">1</div>
                              </div>
                              <div className="podium-user-name" title={firstUser.name}>
                                {firstUser.name} {firstUser.uid === currentUser.uid && " (You)"}
                              </div>
                              <div className="podium-user-username">@{firstUser.username}</div>
                              <div className="podium-xp-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '12px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.95rem', color: 'var(--primary-hover)', fontWeight: 'bold' }}>{firstUser.exp} EXP</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{firstUser.xp} XP</span>
                              </div>
                            </div>
                          )}

                          {/* 3rd Place */}
                          {thirdUser && (
                            <div className={`podium-slot rank-3 ${thirdUser.uid === currentUser.uid ? 'is-current-user' : ''}`}>
                              <div className="podium-avatar-container">
                                <div className="podium-avatar" style={{ background: getAvatarGradient(thirdUser.username) }}>
                                  {getInitials(thirdUser.name)}
                                </div>
                                <div className="podium-avatar-badge">3</div>
                              </div>
                              <div className="podium-user-name" title={thirdUser.name}>
                                {thirdUser.name} {thirdUser.uid === currentUser.uid && " (You)"}
                              </div>
                              <div className="podium-user-username">@{thirdUser.username}</div>
                              <div className="podium-xp-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '12px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--primary-hover)', fontWeight: 'bold' }}>{thirdUser.exp} EXP</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{thirdUser.xp} XP</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Remaining Ranks */}
                      {remainingUsers.length > 0 && (
                        <div className="leaderboard-list-v2">
                          {remainingUsers.map((user, idx) => {
                            const rank = idx + 4;
                            const isCurrentUser = user.uid === currentUser.uid;
                            return (
                              <div
                                key={user.uid}
                                className={`leaderboard-row-v2 ${isCurrentUser ? 'is-current-user' : ''}`}
                              >
                                <div className="leaderboard-row-left">
                                  <span className="leaderboard-row-rank">{rank}</span>
                                  <div
                                    className="leaderboard-row-avatar"
                                    style={{ background: getAvatarGradient(user.username) }}
                                  >
                                    {getInitials(user.name)}
                                  </div>
                                  <div className="leaderboard-row-info">
                                    <span className="leaderboard-row-name">
                                      {user.name} {isCurrentUser && " (You)"}
                                    </span>
                                    <span className="leaderboard-row-username">@{user.username}</span>
                                  </div>
                                </div>
                                <div className="leaderboard-row-xp" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span style={{ fontSize: '0.875rem', color: 'var(--primary-hover)', fontWeight: 'bold' }}>{user.exp} EXP</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{user.xp} XP</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </>
          )}

          {activeTab === "evaluate" && (
            <>
              <div className="dashboard-view-title">Evaluate Peer Submissions</div>
              <p className="dashboard-view-desc">
                Review and rate approved solutions submitted by your peers. Your ratings are fully anonymous to other users, but visible to the admin. You cannot evaluate your own submissions.
              </p>

              {isEvaluating ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <div className="spinner"></div>
                </div>
              ) : evaluateSubmissions.length === 0 ? (
                <div className="empty-placeholder">
                  No peer submissions available for evaluation at this time.
                </div>
              ) : (() => {
                const ITEMS_PER_PAGE = 10;
                const totalEvaluatePages = Math.ceil(evaluateSubmissions.length / ITEMS_PER_PAGE);
                const currentEvaluatePage = Math.min(evaluatePage, Math.max(1, totalEvaluatePages));
                const paginatedEvaluate = evaluateSubmissions.slice((currentEvaluatePage - 1) * ITEMS_PER_PAGE, currentEvaluatePage * ITEMS_PER_PAGE);
                return (
                  <div className="user-table-wrapper">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Submitted By</th>
                          <th>Submitted On</th>
                          <th>Rating Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedEvaluate.map((sub) => {
                          const isExpanded = expandedEvaluateId === sub.id;
                          const currentRating = userRatings.find(r => r.submission_id === sub.id)?.rating || 0;
                          const submitterProfile = leaderboardList.find(u => u.uid === sub.userId);
                          const submitterUsername = submitterProfile?.username || 'user';
                          return (
                            <React.Fragment key={sub.id}>
                              <tr
                                style={{ cursor: "pointer" }}
                                onClick={() => setExpandedEvaluateId(isExpanded ? null : sub.id)}
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
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div
                                      style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        color: "#fff",
                                        background: getAvatarGradient(submitterUsername)
                                      }}
                                    >
                                      {getInitials(sub.userName)}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{sub.userName}</span>
                                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>@{submitterUsername}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    {new Date(sub.submittedAt.toDate()).toLocaleString()}
                                  </span>
                                </td>
                                <td>
                                  {currentRating > 0 ? (
                                    <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>★ {currentRating}</span>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>Not Rated</span>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={4} style={{ backgroundColor: "rgba(255, 255, 255, 0.01)", padding: "1.25rem 1.5rem", borderTop: "none" }}>
                                    <div style={{ paddingLeft: "1.25rem", borderLeft: "2px solid var(--border-color)" }}>
                                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Peer Submission Details</h4>
                                      <div className="submission-content-box" style={{ marginTop: '0.5rem' }}>
                                        {renderSubmissionContent(sub.content)}
                                      </div>
                                      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
                                        <SubmissionStarRating
                                          currentRating={currentRating}
                                          onRate={(val) => handleRateSubmission(sub.id, val)}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    <Pagination currentPage={currentEvaluatePage} totalPages={totalEvaluatePages} onPageChange={setEvaluatePage} />
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === "jobs" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Jobs</div>
              </div>
              <p className="dashboard-view-desc">Complete jobs assigned to you to earn leveling XP.</p>

              {/* Subtabs for Jobs */}
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeJobSubTab === "active" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeJobSubTab === "active" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveJobSubTab("active"); setJobsPage(1); }}
                >
                  Active Jobs ({activeJobs.length})
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeJobSubTab === "pending" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeJobSubTab === "pending" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveJobSubTab("pending"); setJobsHistoryPage(1); }}
                >
                  Pending History ({pendingJobsHistory.length})
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeJobSubTab === "approved" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeJobSubTab === "approved" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveJobSubTab("approved"); setJobsHistoryPage(1); }}
                >
                  Approved History ({approvedJobsHistory.length})
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeJobSubTab === "rejected" ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeJobSubTab === "rejected" ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                  onClick={() => { setActiveJobSubTab("rejected"); setJobsHistoryPage(1); }}
                >
                  Rejected History ({rejectedJobsHistory.length})
                </button>
              </div>

              {activeJobSubTab === "active" ? (
                activeJobs.length === 0 ? (
                  <div className="empty-placeholder">
                    No active jobs assigned to your account at this time.
                  </div>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalJobsPages = Math.ceil(activeJobs.length / ITEMS_PER_PAGE);
                  const currentJobsPage = Math.min(jobsPage, Math.max(1, totalJobsPages));
                  const paginatedJobs = activeJobs.slice((currentJobsPage - 1) * ITEMS_PER_PAGE, currentJobsPage * ITEMS_PER_PAGE);
                  return (
                    <div className="user-table-wrapper">
                      <table className="user-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Deadline</th>
                            <th>Status</th>
                            <th>XP Reward</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedJobs.map((job) => {
                            const statusInfo = getJobStatusInfo(job.id);
                            const isOverdue = new Date(job.deadline.toDate()) < new Date();
                            return (
                              <tr key={job.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong>{job.title}</strong>
                                    {job.description && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                                        title="View Description"
                                        onClick={() => setViewingDescription(job.description)}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                          <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className={`task-deadline ${isOverdue ? "urgent" : "upcoming"}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                    {new Date(job.deadline.toDate()).toLocaleString()}
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-capsule ${statusInfo.class}`}>
                                    {statusInfo.label}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '0.85rem' }}>{job.xpReward} XP</span>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                      setActiveSubmitJob(job);
                                      setIsJobSubmitModalOpen(true);
                                    }}
                                  >
                                    Submit Solution
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <Pagination currentPage={currentJobsPage} totalPages={totalJobsPages} onPageChange={setJobsPage} />
                    </div>
                  );
                })()
              ) : (() => {
                const subtabItems = 
                  activeJobSubTab === "pending" ? pendingJobsHistory :
                  activeJobSubTab === "approved" ? approvedJobsHistory :
                  rejectedJobsHistory;

                return subtabItems.length === 0 ? (
                  <div className="empty-placeholder">
                    {activeJobSubTab === "pending" ? "No pending job submissions found." :
                     activeJobSubTab === "approved" ? "No approved job submissions found." :
                     "No rejected or expired jobs found."}
                  </div>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalJobsHistoryPages = Math.ceil(subtabItems.length / ITEMS_PER_PAGE);
                  const currentJobsHistoryPage = Math.min(jobsHistoryPage, Math.max(1, totalJobsHistoryPages));
                  const paginatedJobSubmissions = subtabItems.slice((currentJobsHistoryPage - 1) * ITEMS_PER_PAGE, currentJobsHistoryPage * ITEMS_PER_PAGE);
                  return (
                    <div className="user-table-wrapper">
                      <table className="user-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Job Title</th>
                            <th>{activeJobSubTab === "rejected" ? "Submitted/Deadline" : "Submitted On"}</th>
                            <th>Status</th>
                            <th>{activeJobSubTab === "approved" ? "XP Awarded" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedJobSubmissions.map((item) => {
                            const isExpanded = expandedSubmissionId === item.id;
                            const isOverdue = item.job ? new Date(item.job.deadline.toDate()) < new Date() : true;

                            return (
                              <React.Fragment key={item.id}>
                                <tr
                                  style={{ cursor: item.submission ? "pointer" : "default" }}
                                  onClick={() => {
                                    if (item.submission) {
                                      setExpandedSubmissionId(isExpanded ? null : item.id);
                                    }
                                  }}
                                >
                                  <td>
                                    {item.submission && (
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
                                    )}
                                  </td>
                                  <td>
                                    <strong>{item.jobTitle}</strong>
                                  </td>
                                  <td>
                                    <span style={{ color: "var(--text-muted)" }}>
                                      {new Date(item.submittedAt.toDate()).toLocaleString()}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-capsule ${item.status}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td>
                                    {activeJobSubTab === "approved" ? (
                                      <span className="xp-gained-value" style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>+{item.xpAwarded} XP</span>
                                    ) : (
                                      !isOverdue ? (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.submission) {
                                              if (window.confirm("Resubmitting will reset your current status and deduct any awarded XP for this job until it is re-evaluated. Do you wish to proceed?")) {
                                                setActiveSubmitJob(item.job);
                                                setJobSubText("");
                                                setJobSubmissionContent("");
                                                setJobSubLink("");
                                                setJobSubFile(null);
                                                setIsJobSubmitModalOpen(true);
                                              }
                                            } else {
                                              setActiveSubmitJob(item.job);
                                              setIsJobSubmitModalOpen(true);
                                            }
                                          }}
                                        >
                                          {item.submission ? "Resubmit" : "Submit Solution"}
                                        </button>
                                      ) : (
                                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Expired</span>
                                      )
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && item.submission && (
                                  <tr>
                                    <td colSpan={5} style={{ backgroundColor: "rgba(255, 255, 255, 0.01)", padding: "1.25rem 1.5rem", borderTop: "none" }}>
                                      <div style={{ paddingLeft: "1.25rem", borderLeft: "2px solid var(--border-color)" }}>
                                        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Your Submission Details</h4>
                                        {renderSubmissionContent(item.submission.content)}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                      <Pagination currentPage={currentJobsHistoryPage} totalPages={totalJobsHistoryPages} onPageChange={setJobsHistoryPage} />
                    </div>
                  );
                })()
              })()}
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

      {/* Submit Job Solution Modal */}
      {isJobSubmitModalOpen && activeSubmitJob && (
        <div className="modal-overlay" onClick={() => {
          setIsJobSubmitModalOpen(false);
          setJobSubmissionContent("");
          setJobSubText("");
          setJobSubLink("");
          setJobSubFile(null);
        }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Submit Job Solution</div>
              <button type="button" className="modal-close-btn" onClick={() => {
                setIsJobSubmitModalOpen(false);
                setJobSubmissionContent("");
                setJobSubText("");
                setJobSubLink("");
                setJobSubFile(null);
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{activeSubmitJob.title}</strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{activeSubmitJob.description}</p>
              </div>
              <form onSubmit={(e) => handleJobSubmit(e, activeSubmitJob)}>
                {(() => {
                  const reqFields = activeSubmitJob.requiredFields || ["textarea"];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {reqFields.includes("text") && (
                        <div className="form-group">
                          <label className="form-label">Short Answer</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Provide a brief summary or direct answer..."
                            value={jobSubText}
                            onChange={(e) => setJobSubText(e.target.value)}
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
                            value={jobSubmissionContent}
                            onChange={(e) => setJobSubmissionContent(e.target.value)}
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
                            value={jobSubLink}
                            onChange={(e) => setJobSubLink(e.target.value)}
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
                                      setJobSubFile(null);
                                    } else {
                                      setJobSubFile(compressed);
                                      onShowToast(`Image compressed successfully (${(compressed.size / (1024 * 1024)).toFixed(2)} MB)`, "success");
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    onShowToast("Error compressing image.", "error");
                                    e.target.value = "";
                                    setJobSubFile(null);
                                  }
                                } else {
                                  onShowToast("File exceeds 5MB size limit.", "error");
                                  e.target.value = "";
                                  setJobSubFile(null);
                                }
                              } else {
                                setJobSubFile(file);
                              }
                            }}
                            required={!jobSubFile}
                          />
                          {jobSubFile && (
                            <span style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "0.25rem", display: "inline-block" }}>
                              Selected: {jobSubFile.name} ({(jobSubFile.size / (1024 * 1024)).toFixed(2)} MB)
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
                      setIsJobSubmitModalOpen(false);
                      setJobSubmissionContent("");
                      setJobSubText("");
                      setJobSubLink("");
                      setJobSubFile(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={jobSubmitting}>
                    {jobSubmitting ? "Submitting..." : "Send for Approval"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {viewingDescription && (
        <div className="modal-overlay" onClick={() => setViewingDescription(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Task Description</h3>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setViewingDescription(null)}>✕</button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.9rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {viewingDescription}
            </div>
          </div>
        </div>
      )}

      {/* Daily XP Rewards Modal */}
      {isDailyRewardOpen && (
        <div className="modal-overlay" onClick={() => setIsDailyRewardOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2.5">
                  <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
                Daily XP Rewards
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsDailyRewardOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Claim your daily leveling XP rewards! If you miss a day, your streak will reset to Day 1.
              </p>

              {streakStatus.isReset && (
                <div className="streak-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Oh no! You missed yesterday's reward. Your streak has reset to Day 1.</span>
                </div>
              )}

              <div className="daily-rewards-grid">
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                  let cardState: "claimed" | "active" | "locked" = "locked";
                  
                  if (streakStatus.canClaim) {
                    if (streakStatus.isReset) {
                      cardState = dayNum === 1 ? "active" : "locked";
                    } else {
                      if (dayNum < streakStatus.nextDay) {
                        cardState = "claimed";
                      } else if (dayNum === streakStatus.nextDay) {
                        cardState = "active";
                      } else {
                        cardState = "locked";
                      }
                    }
                  } else {
                    if (dayNum <= currentStreak) {
                      cardState = "claimed";
                    } else {
                      cardState = "locked";
                    }
                  }

                  return (
                    <div key={dayNum} className={`reward-card ${cardState}`}>
                      <div className="day-label">Day {dayNum}</div>
                      <div className="reward-icon">
                        {cardState === "claimed" ? (
                          <span style={{ color: 'var(--success)' }}>✓</span>
                        ) : cardState === "active" ? (
                          <span>🎁</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>🔒</span>
                        )}
                      </div>
                      <div className="reward-value">
                        {cardState === "claimed" ? (
                          `+${getXPForDay(dayNum)} XP`
                        ) : (
                          "? XP"
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {claimedXpRevealed !== null ? (
                <div className="daily-success-banner">
                  <h3>Claim Successful!</h3>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0.25rem 0' }}>
                    You earned <span style={{ color: 'var(--accent-gold)' }}>+{claimedXpRevealed} XP</span>!
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Your current streak is now {currentStreak} {currentStreak === 1 ? 'day' : 'days'}. Come back tomorrow to claim more!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Current Streak: <strong style={{ color: 'var(--text-primary)' }}>{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</strong>
                    </div>
                    {streakStatus.canClaim && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Today's Reward: <strong style={{ color: 'var(--accent-gold)' }}>Mystery XP</strong>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    disabled={!streakStatus.canClaim || isClaimingDaily}
                    onClick={handleClaimDailyReward}
                  >
                    {isClaimingDaily ? "Claiming..." : streakStatus.canClaim ? "Claim Today's Reward" : "Reward Already Claimed Today"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Level-Up Animation Overlay */}
      {levelUpAnim && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.25) 0%, rgba(0,0,0,0.85) 100%)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onClick={() => setLevelUpAnim(null)}
        >
          <style>{`
            @keyframes fadeInScale {
              from { opacity: 0; transform: scale(0.7); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes levelUpPulse {
              0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(20,184,166,0.2); }
              50% { box-shadow: 0 0 80px rgba(99,102,241,0.7), 0 0 140px rgba(20,184,166,0.4); }
            }
            @keyframes confettiBounce {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(-80px) rotate(360deg); opacity: 0; }
            }
            @keyframes shimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
          `}</style>
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              border: '2px solid rgba(99,102,241,0.5)',
              borderRadius: '24px',
              padding: '3rem 4rem',
              textAlign: 'center',
              maxWidth: '480px',
              width: '90%',
              animation: 'levelUpPulse 2s ease-in-out infinite',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confetti particles */}
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#10b981'][i % 5],
                top: `${Math.random() * 80 + 10}%`,
                left: `${(i / 12) * 100}%`,
                animation: `confettiBounce ${0.8 + Math.random() * 0.8}s ease-out ${i * 0.1}s infinite alternate`,
              }} />
            ))}

            <div style={{ fontSize: '4rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 0 20px gold)' }}>⚡</div>
            <div style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}>Level Up!</div>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #6366f1, #14b8a6, #f59e0b, #6366f1)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'shimmer 2s linear infinite',
              marginBottom: '1.5rem',
            }}>
              {levelUpAnim.toLevel}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>FROM</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0.4rem 0.9rem', background: 'var(--bg-surface-elevated)', borderRadius: '8px' }}>{levelUpAnim.fromLevel}</div>
              </div>
              <div style={{ fontSize: '1.5rem', color: 'var(--primary-hover)' }}>→</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>TO</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', padding: '0.4rem 0.9rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '8px' }}>{levelUpAnim.toLevel}</div>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              🎉 Congratulations! Keep earning XP to unlock the next level!
            </p>
            <button
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', border: 'none', padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 700, borderRadius: '12px' }}
              onClick={() => setLevelUpAnim(null)}
            >
              Awesome! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && (() => {
        const xp = userProfile?.xp ?? 0;
        const levelInfo = getCurrentLevelInfo(xp, allLevels);
        return (
          <div className="modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
            <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">My Profile</div>
                <button type="button" className="modal-close-btn" onClick={() => setIsProfileModalOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="modal-body" style={{ paddingTop: '0.5rem' }}>
                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: getAvatarGradient(userProfile?.username || currentUser.email),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.75rem', fontWeight: 900, color: '#fff',
                    border: '3px solid var(--primary)',
                    boxShadow: '0 0 20px var(--primary-glow)',
                    flexShrink: 0,
                  }}>
                    {getInitials(userProfile?.name || currentUser.email)}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{userProfile?.name || "—"}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>@{userProfile?.username || "—"}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{currentUser.email}</div>
                    {levelInfo && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '0.2rem 0.65rem', borderRadius: '99px' }}>
                          ⚡ {levelInfo.currentLevel.level_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-hover)' }}>{userProfile?.exp ?? 0}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>EXP</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{xp}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>XP</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--secondary)' }}>#{typeof userRank === 'number' ? userRank : '—'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Rank</div>
                  </div>
                </div>

                {/* XP Level Progress */}
                {levelInfo ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Level Progress</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {levelInfo.progressCurrent} / {levelInfo.progressMax} XP
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '14px', background: 'var(--bg-surface-elevated)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        height: '100%',
                        width: `${levelInfo.pct}%`,
                        background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                        borderRadius: '99px',
                        transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxShadow: '0 0 10px rgba(99,102,241,0.5)',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{levelInfo.currentLevel.level_name}</span>
                      {levelInfo.nextLevel && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {levelInfo.nextLevel.level_name} at {levelInfo.nextLevel.min_xp} XP
                        </span>
                      )}
                    </div>
                    {!levelInfo.nextLevel && (
                      <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                        🏆 You've reached the highest level!
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    No levels configured yet. Ask your admin to set up the leveling system.
                  </div>
                )}

                {/* Streak info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
                    Daily Streak
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1rem' }}>
                    {userProfile?.daily_streak ?? userProfile?.dailyStreak ?? 0} days 🔥
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
