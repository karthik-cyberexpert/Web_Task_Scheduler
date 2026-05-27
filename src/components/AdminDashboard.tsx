import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as authSignOut } from "firebase/auth";
import { supabase } from "../supabaseClient";
import { SpotlightCard, ShinyText, CountUp, BlurReveal } from "./reactbits";
import { sendGreetingEmail, sendTaskAssignmentEmail } from "../utils/email";



interface AdminDashboardProps {
  onShowToast: (message: string, type: "success" | "error") => void;
  currentUser: any;
  onBackToUser: () => void;
}

const CompactSuspensionCountdown: React.FC<{ suspendedUntil: string }> = ({ suspendedUntil }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(suspendedUntil).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      parts.push(String(hours).padStart(2, "0"));
      parts.push(String(minutes).padStart(2, "0"));
      parts.push(String(seconds).padStart(2, "0"));

      setTimeLeft(parts.join(":"));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [suspendedUntil]);

  return (
    <span style={{ fontSize: "0.65rem", color: "var(--accent-gold)", marginLeft: "0.25rem", fontFamily: "monospace" }}>
      ({timeLeft})
    </span>
  );
};

// Helpers to map Supabase snake_case rows to the camelCase formats with mock Firebase timestamps (.toDate())
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

const QuestQuestionBuilderForm: React.FC<{ onAdd: (q: any) => void }> = ({ onAdd }) => {
  const [type, setType] = useState<"mcq" | "text" | "link" | "upload">("mcq");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  const [answer, setAnswer] = useState("");
  const [xp, setXp] = useState("10");
  const [exp, setExp] = useState("50");

  const handleAdd = () => {
    if (!question.trim()) return;
    const optArr = type === "mcq" ? options.split(",").map(o => o.trim()).filter(Boolean) : [];
    
    onAdd({
      type,
      question: question.trim(),
      options: optArr,
      answer: type === "mcq" ? answer.trim() : undefined,
      xp_reward: parseInt(xp, 10) || 0,
      exp_reward: parseInt(exp, 10) || 0
    });

    setQuestion("");
    setOptions("");
    setAnswer("");
    setXp("10");
    setExp("50");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Type</label>
          <select className="form-control" value={type} onChange={(e: any) => setType(e.target.value)} style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }}>
            <option value="mcq">MCQ Choice</option>
            <option value="text">Short/Long Text Response</option>
            <option value="link">Resource Link Submission</option>
            <option value="upload">File Upload</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Question/Prompt</label>
          <input type="text" className="form-control" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Enter prompt..." style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
        </div>
      </div>

      {type === "mcq" && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Options (comma-separated)</label>
            <input type="text" className="form-control" value={options} onChange={e => setOptions(e.target.value)} placeholder="e.g. A, B, C, D" style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Correct Answer</label>
            <input type="text" className="form-control" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Matches one option" style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>XP Reward</label>
          <input type="number" className="form-control" value={xp} onChange={e => setXp(e.target.value)} min={0} style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXP Reward</label>
          <input type="number" className="form-control" value={exp} onChange={e => setExp(e.target.value)} min={0} style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
        </div>
        <button type="button" className="btn btn-primary" onClick={handleAdd} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', height: 'fit-content' }}>
          Add
        </button>
      </div>
    </div>
  );
};

const QuestParticipantGradingAction: React.FC<{
  maxScore: number;
  defaultXp: number;
  defaultExp: number;
  onGrade: (score: number, xp: number, exp: number, success: boolean) => void;
}> = ({ maxScore, defaultXp, defaultExp, onGrade }) => {
  const [score, setScore] = useState(String(maxScore));
  const [xp, setXp] = useState(String(defaultXp));
  const [exp, setExp] = useState(String(defaultExp));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end', background: 'var(--bg-surface-hover)', padding: '0.75rem', borderRadius: '4px', marginTop: '0.5rem' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Score (Max {maxScore})</label>
        <input type="number" className="form-control" value={score} onChange={e => setScore(e.target.value)} min={0} style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>XP Awarded</label>
        <input type="number" className="form-control" value={xp} onChange={e => setXp(e.target.value)} min={0} style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXP Awarded</label>
        <input type="number" className="form-control" value={exp} onChange={e => setExp(e.target.value)} min={0} style={{ padding: '0.25rem', height: 'auto', fontSize: '0.75rem' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
          onClick={() => onGrade(parseInt(score, 10) || 0, parseInt(xp, 10) || 0, parseInt(exp, 10) || 0, true)}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)' }}
          onClick={() => onGrade(0, 0, 0, false)}
        >
          Fail
        </button>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onShowToast, currentUser, onBackToUser }) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "users" | "leaderboard" | "jobs" | "levels" | "quests">("overview");

  // Quests state
  const [questsList, setQuestsList] = useState<any[]>([]);
  const [questParticipants, setQuestParticipants] = useState<any[]>([]);
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<any | null>(null);
  const [questTitle, setQuestTitle] = useState("");
  const [questDescription, setQuestDescription] = useState("");
  const [questCategory, setQuestCategory] = useState<"weekly" | "monthly">("weekly");
  const [questStartTime, setQuestStartTime] = useState("");
  const [questEndTime, setQuestEndTime] = useState("");
  const [questMinExp, setQuestMinExp] = useState("0");
  const [questMinXp, setQuestMinXp] = useState("0");
  const [questQuestions, setQuestQuestions] = useState<any[]>([]);
  const [questStep, setQuestStep] = useState(1);
  const [questCreating, setQuestCreating] = useState(false);

  const [selectedQuestForGrading, setSelectedQuestForGrading] = useState<any>(null);
  const [isQuestGradingModalOpen, setIsQuestGradingModalOpen] = useState(false);
  const [questGradingParticipants, setQuestGradingParticipants] = useState<any[]>([]);
  const [questGradingLoading, setQuestGradingLoading] = useState(false);

  // Levels state
  const [levelsList, setLevelsList] = useState<any[]>([]);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any | null>(null);
  const [levelName, setLevelName] = useState("");
  const [levelMinXP, setLevelMinXP] = useState("0");
  const [levelMaxXP, setLevelMaxXP] = useState("");
  const [levelCreating, setLevelCreating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchTasks(),
        fetchSubmissions(),
        fetchJobs(),
        fetchJobSubmissions(),
        fetchQuests(),
        fetchQuestParticipants()
      ]);
      onShowToast("Dashboard data refreshed!", "success");
    } catch (err: any) {
      console.error("Refresh error:", err);
      onShowToast("Failed to refresh data.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [taskStep, setTaskStep] = useState(1);

  // Submissions modal states
  const [selectedTaskForSubmissions, setSelectedTaskForSubmissions] = useState<any>(null);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [modalSubmissions, setModalSubmissions] = useState<any[]>([]);
  const [modalRatings, setModalRatings] = useState<any[]>([]);
  const [modalSubmissionsLoading, setModalSubmissionsLoading] = useState(false);
  const [modalTab, setModalTab] = useState<"pending" | "approved">("pending");

  // Stats states
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);

  // Forms states
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [userCreating, setUserCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<any>(null);
  const [suspendType, setSuspendType] = useState<"day" | "hour">("day");
  const [suspendDays, setSuspendDays] = useState("0");
  const [suspendHours, setSuspendHours] = useState("0");
  const [suspendMinutes, setSuspendMinutes] = useState("0");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  // Jobs states
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [allJobSubmissions, setAllJobSubmissions] = useState<any[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobStep, setJobStep] = useState(1);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobDeadline, setJobDeadline] = useState("");
  const [jobAssignedType, setJobAssignedType] = useState<"all" | "specific">("all");
  const [selectedJobUserIds, setSelectedJobUserIds] = useState<string[]>([]);
  const [jobXPReward, setJobXPReward] = useState("50");
  const [jobRequiredFields, setJobRequiredFields] = useState<string[]>(["textarea"]);
  const [jobCreating, setJobCreating] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [isJobCalendarPopupOpen, setIsJobCalendarPopupOpen] = useState(false);
  const [selectedJobCalendarDate, setSelectedJobCalendarDate] = useState<Date | null>(null);
  const [jobCalendarHour, setJobCalendarHour] = useState("00");
  const [jobCalendarMinute, setJobCalendarMinute] = useState("00");
  const [selectedJobForSubmissions, setSelectedJobForSubmissions] = useState<any>(null);
  const [isJobSubmissionsModalOpen, setIsJobSubmissionsModalOpen] = useState(false);
  const [modalJobSubmissions, setModalJobSubmissions] = useState<any[]>([]);
  const [modalJobSubmissionsLoading, setModalJobSubmissionsLoading] = useState(false);
  const [modalJobTab, setModalJobTab] = useState<"pending" | "approved">("pending");
  const [activeJobMenuId, setActiveJobMenuId] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskAssignedType, setTaskAssignedType] = useState<"all" | "specific">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [maxXP, setMaxXP] = useState("500");
  const [taskXPReward, setTaskXPReward] = useState("0");
  const [taskCreating, setTaskCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [requiredFields, setRequiredFields] = useState<string[]>(["textarea"]);

  // Calendar and User Selection states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState(new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [calendarHour, setCalendarHour] = useState("00");
  const [calendarMinute, setCalendarMinute] = useState("00");
  const [isCalendarPopupOpen, setIsCalendarPopupOpen] = useState(false);

  // Calendar helper functions
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (currentCalendarMonth === 0) {
      setCurrentCalendarMonth(11);
      setCurrentCalendarYear(prev => prev - 1);
    } else {
      setCurrentCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentCalendarMonth === 11) {
      setCurrentCalendarMonth(0);
      setCurrentCalendarYear(prev => prev + 1);
    } else {
      setCurrentCalendarMonth(prev => prev + 1);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[month];
  };

  const updateDeadlineFromCalendar = (date: Date | null, hr: string, min: string) => {
    if (!date) return;
    const finalDate = new Date(date);
    let hourNum = parseInt(hr, 10);
    if (isNaN(hourNum) || hourNum < 0) hourNum = 0;
    if (hourNum > 23) hourNum = 23;
    let minNum = parseInt(min, 10);
    if (isNaN(minNum) || minNum < 0) minNum = 0;
    if (minNum > 59) minNum = 59;
    
    finalDate.setHours(hourNum);
    finalDate.setMinutes(minNum);
    finalDate.setSeconds(0);
    finalDate.setMilliseconds(0);
    
    const year = finalDate.getFullYear();
    const month = String(finalDate.getMonth() + 1).padStart(2, "0");
    const day = String(finalDate.getDate()).padStart(2, "0");
    const hoursStr = String(finalDate.getHours()).padStart(2, "0");
    const minutesStr = String(finalDate.getMinutes()).padStart(2, "0");
    
    setTaskDeadline(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentCalendarMonth, currentCalendarYear);
    const firstDayIndex = getFirstDayOfMonth(currentCalendarMonth, currentCalendarYear);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: React.ReactNode[] = [];

    // Empty cells for days before the first of the month
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} style={{ width: '100%', aspectRatio: '1', padding: '0.25rem' }}></div>);
    }

    // Days in the month
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDate = new Date(currentCalendarYear, currentCalendarMonth, dayNum);
      const isSelected = selectedCalendarDate && 
        selectedCalendarDate.getDate() === dayNum && 
        selectedCalendarDate.getMonth() === currentCalendarMonth && 
        selectedCalendarDate.getFullYear() === currentCalendarYear;
      
      const isToday = today.getDate() === dayNum && 
        today.getMonth() === currentCalendarMonth && 
        today.getFullYear() === currentCalendarYear;

      const isPast = cellDate < today;

      cells.push(
        <button
          key={`day-${dayNum}`}
          type="button"
          disabled={isPast}
          onClick={() => {
            setSelectedCalendarDate(cellDate);
            updateDeadlineFromCalendar(cellDate, calendarHour, calendarMinute);
          }}
          style={{
            width: '100%',
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            fontWeight: isSelected ? '700' : '500',
            borderRadius: '6px',
            border: 'none',
            cursor: isPast ? 'not-allowed' : 'pointer',
            backgroundColor: isSelected 
              ? 'var(--primary)' 
              : isToday 
                ? 'var(--bg-surface-hover)' 
                : 'transparent',
            color: isSelected 
              ? '#fff' 
              : isPast 
                ? 'var(--text-muted)' 
                : 'var(--text-primary)',
            transition: 'all var(--transition-fast)',
            outline: 'none',
          }}
        >
          {dayNum}
        </button>
      );
    }

    return cells;
  };

  // Real-time Lists

  const [usersList, setUsersList] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [tasksPage, setTasksPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users from Supabase:", error);
      return;
    }
    if (data) {
      const mapped = data.map(mapUser);
      setUsersList(mapped);
      setTotalUsers(mapped.length);
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
      setTasksList(mapped);
      setActiveTasksCount(mapped.filter((t: any) => t.status === "active").length);
    }
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions from Supabase:", error);
      return;
    }
    if (data) {
      const mapped = data.map(mapSubmission);
      setAllSubmissions(mapped);
      const pending = mapped.filter((sub: any) => sub.status === "pending");
      setPendingSubmissionsCount(pending.length);
    }
  };

  const fetchLevels = async () => {
    const { data, error } = await supabase
      .from("levels")
      .select("*")
      .order("min_xp", { ascending: true });
    if (error) {
      console.error("Error fetching levels:", error);
      return;
    }
    if (data) setLevelsList(data);
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
      setJobsList(data.map(mapJob));
    }
  };

  const fetchJobSubmissions = async () => {
    const { data, error } = await supabase
      .from("job_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching job submissions from Supabase:", error);
      return;
    }
    if (data) {
      setAllJobSubmissions(data.map(mapJobSubmission));
    }
  };

  const fetchQuests = async () => {
    const { data, error } = await supabase
      .from("quests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quests:", error);
      return;
    }
    if (data) {
      setQuestsList(data);
    }
  };

  const fetchQuestParticipants = async () => {
    const { data, error } = await supabase
      .from("quest_participants")
      .select("*")
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Error fetching quest participants:", error);
      return;
    }
    if (data) {
      setQuestParticipants(data);
    }
  };

  // Real-time listeners
  useEffect(() => {
    fetchUsers();
    fetchTasks();
    fetchSubmissions();
    fetchJobs();
    fetchJobSubmissions();
    fetchLevels();
    fetchQuests();
    fetchQuestParticipants();

    // Subscribe to public database changes in Supabase
    const usersChannel = supabase
      .channel("users-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchUsers)
      .subscribe();

    const tasksChannel = supabase
      .channel("tasks-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks)
      .subscribe();

    const submissionsChannel = supabase
      .channel("submissions-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        fetchSubmissions();
        // Recalculating approvals might affect user XP, so reload users/tasks too
        fetchUsers();
        fetchTasks();
      })
      .subscribe();

    const jobsChannel = supabase
      .channel("jobs-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, fetchJobs)
      .subscribe();

    const jobSubmissionsChannel = supabase
      .channel("job-submissions-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_submissions" }, () => {
        fetchJobs();
        fetchUsers();
        fetchJobSubmissions();
      })
      .subscribe();

    const levelsChannel = supabase
      .channel("levels-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "levels" }, fetchLevels)
      .subscribe();

    const questsChannel = supabase
      .channel("quests-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "quests" }, fetchQuests)
      .subscribe();

    const questParticipantsChannel = supabase
      .channel("quest-participants-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "quest_participants" }, () => {
        fetchQuestParticipants();
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(submissionsChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(jobSubmissionsChannel);
      supabase.removeChannel(levelsChannel);
      supabase.removeChannel(questsChannel);
      supabase.removeChannel(questParticipantsChannel);
    };
  }, []);

  const fetchModalSubmissionsAndRatings = async () => {
    if (!selectedTaskForSubmissions) return;
    setModalSubmissionsLoading(true);
    try {
      const { data: subsData, error: subsError } = await supabase
        .from("submissions")
        .select("*")
        .eq("task_id", selectedTaskForSubmissions.id)
        .order("submitted_at", { ascending: false });

      if (subsError) throw subsError;

      const subIds = (subsData || []).map(s => s.id);
      let ratingsData: any[] = [];
      if (subIds.length > 0) {
        const { data: ratData, error: ratError } = await supabase
          .from("submission_ratings")
          .select("*")
          .in("submission_id", subIds);
        if (ratError) throw ratError;
        ratingsData = ratData || [];
      }

      setModalSubmissions((subsData || []).map(mapSubmission));
      setModalRatings(ratingsData);
    } catch (err) {
      console.error("Error fetching modal subs/ratings:", err);
    } finally {
      setModalSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (isSubmissionsModalOpen && selectedTaskForSubmissions) {
      fetchModalSubmissionsAndRatings();
    }
  }, [isSubmissionsModalOpen, selectedTaskForSubmissions]);

  const handlePublishTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ published_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) throw error;
      onShowToast("Task published to Evaluate page successfully!", "success");
      fetchTasks();
    } catch (err: any) {
      console.error("Error publishing task:", err);
      onShowToast(err.message || "Failed to publish task.", "error");
    }
  };

  // Quest Handlers
  const resetQuestFields = () => {
    setEditingQuest(null);
    setQuestTitle("");
    setQuestDescription("");
    setQuestCategory("weekly");
    setQuestStartTime("");
    setQuestEndTime("");
    setQuestMinExp("0");
    setQuestMinXp("0");
    setQuestQuestions([]);
    setQuestStep(1);

  };

  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questTitle.trim() || !questDescription.trim() || !questStartTime || !questEndTime) {
      onShowToast("Quest title, description, start time, and end time are required.", "error");
      return;
    }

    const minExpVal = parseInt(questMinExp, 10) || 0;
    const minXpVal = parseInt(questMinXp, 10) || 0;

    if (questQuestions.length === 0) {
      onShowToast("Please add at least one question to the quest.", "error");
      return;
    }

    setQuestCreating(true);
    try {
      const payload = {
        title: questTitle.trim(),
        description: questDescription.trim(),
        category: questCategory,
        min_exp: minExpVal,
        min_xp: minXpVal,
        start_time: new Date(questStartTime).toISOString(),
        end_time: new Date(questEndTime).toISOString(),
        quest_data: questQuestions,
        created_by_id: currentUser.uid,
      };

      if (editingQuest) {
        const { error } = await supabase
          .from("quests")
          .update(payload)
          .eq("id", editingQuest.id);
        if (error) throw error;
        onShowToast("Quest updated successfully!", "success");
      } else {
        const { error } = await supabase
          .from("quests")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
        onShowToast("Quest created successfully!", "success");
      }

      setIsQuestModalOpen(false);
      resetQuestFields();
      fetchQuests();
    } catch (err: any) {
      console.error("Error saving quest:", err);
      onShowToast(err.message || "Failed to save quest.", "error");
    } finally {
      setQuestCreating(false);
    }
  };

  const handleDeleteQuest = async (questId: string) => {
    if (!window.confirm("Are you sure you want to delete this quest? This will permanently delete all associated participant records and submissions.")) return;
    try {
      const { error } = await supabase.from("quests").delete().eq("id", questId);
      if (error) throw error;
      onShowToast("Quest deleted successfully!", "success");
      fetchQuests();
    } catch (err: any) {
      console.error("Error deleting quest:", err);
      onShowToast(err.message || "Failed to delete quest.", "error");
    }
  };

  const fetchQuestGradingParticipants = async (questId: string) => {
    setQuestGradingLoading(true);
    try {
      const { data, error } = await supabase
        .from("quest_participants")
        .select(`
          *,
          users:user_id (uid, name, username, email)
        `)
        .eq("quest_id", questId);
      
      if (error) throw error;
      setQuestGradingParticipants(data || []);
    } catch (err: any) {
      console.error("Error fetching quest grading participants:", err);
      onShowToast("Failed to load participants.", "error");
    } finally {
      setQuestGradingLoading(false);
    }
  };

  const handleGradeQuestParticipant = async (participantId: string, userId: string, score: number, xpEarned: number, expEarned: number, status: "completed" | "failed") => {
    try {
      const { error: partError } = await supabase
        .from("quest_participants")
        .update({
          status,
          score,
          xp_earned: xpEarned,
          exp_earned: expEarned,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", participantId);

      if (partError) throw partError;

      const { data: userData, error: userFetchErr } = await supabase
        .from("users")
        .select("xp, exp")
        .eq("uid", userId)
        .maybeSingle();

      if (userFetchErr) throw userFetchErr;

      const currentXp = userData?.xp || 0;
      const currentExp = userData?.exp || 0;

      const { error: userUpdateErr } = await supabase
        .from("users")
        .update({
          xp: currentXp + xpEarned,
          exp: currentExp + expEarned
        })
        .eq("uid", userId);

      if (userUpdateErr) throw userUpdateErr;

      onShowToast("Submission graded and rewards distributed successfully!", "success");
      
      if (selectedQuestForGrading) {
        fetchQuestGradingParticipants(selectedQuestForGrading.id);
      }
      fetchQuestParticipants();
      fetchUsers();
    } catch (err: any) {
      console.error("Error grading participant:", err);
      onShowToast(err.message || "Failed to grade submission.", "error");
    }
  };



  // Create or Update User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernameClean = newUserUsername.trim().toLowerCase();
    
    if (!newUserName.trim() || !usernameClean || !newUserEmail.trim()) {
      onShowToast("All fields are required.", "error");
      return;
    }
    
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(usernameClean)) {
      onShowToast("Username can only contain letters, numbers, underscores, and dashes.", "error");
      return;
    }

    setUserCreating(true);
    let secondaryApp;
    try {
      if (editingUser) {
        // Check for duplicate username in Supabase (excluding current user)
        const { data: existingUser, error: checkErr } = await supabase
          .from("users")
          .select("uid")
          .eq("username", usernameClean)
          .neq("uid", editingUser.uid)
          .maybeSingle();

        if (checkErr) {
          console.error("Error checking username uniqueness:", checkErr);
        }

        if (existingUser) {
          onShowToast("This username is already taken.", "error");
          setUserCreating(false);
          return;
        }

        const { error: updateErr } = await supabase
          .from("users")
          .update({
            name: newUserName.trim(),
            username: usernameClean,
            email: newUserEmail.trim().toLowerCase(),
            role: newUserRole,
          })
          .eq("uid", editingUser.uid);

        if (updateErr) {
          throw new Error(updateErr.message);
        }

        onShowToast(`User profile for "${newUserName.trim()}" updated successfully!`, "success");
      } else {
        // Check for duplicate username in Supabase
        const { data: existingUser, error: checkErr } = await supabase
          .from("users")
          .select("uid")
          .eq("username", usernameClean)
          .maybeSingle();

        if (checkErr) {
          console.error("Error checking username uniqueness:", checkErr);
        }

        if (existingUser) {
          onShowToast("This username is already taken.", "error");
          setUserCreating(false);
          return;
        }

        // Check for duplicate email in Supabase
        const { data: existingEmailUser, error: emailCheckErr } = await supabase
          .from("users")
          .select("uid")
          .eq("email", newUserEmail.trim().toLowerCase())
          .maybeSingle();

        if (emailCheckErr) {
          console.error("Error checking email uniqueness:", emailCheckErr);
        }

        if (existingEmailUser) {
          onShowToast("This email address is already registered in the system.", "error");
          setUserCreating(false);
          return;
        }

        // Secondary App settings to avoid logging out the admin
        const secondaryAppName = "SecondaryApp-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        secondaryApp = initializeApp(
          {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
            measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
          },
          secondaryAppName
        );

        const secondaryAuth = getAuth(secondaryApp);
        let createdUser;
        try {
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            newUserEmail.trim(),
            "user@sydions"
          );
          createdUser = userCredential.user;
        } catch (authErr: any) {
          if (authErr.code === "auth/email-already-in-use") {
            try {
              const userCredential = await signInWithEmailAndPassword(
                secondaryAuth,
                newUserEmail.trim(),
                "user@sydions"
              );
              createdUser = userCredential.user;
            } catch (signInErr) {
              throw authErr;
            }
          } else {
            throw authErr;
          }
        }

        // Log out of the secondary app instance and clean up
        await authSignOut(secondaryAuth);
        try { await deleteApp(secondaryApp); } catch (_) {}
        secondaryApp = null;

        // Store in Supabase users table (upsert to handle re-registration of previously deleted users)
        const { error: insertErr } = await supabase.from("users").upsert({
          uid: createdUser.uid,
          email: newUserEmail.trim().toLowerCase(),
          username: usernameClean,
          name: newUserName.trim(),
          role: newUserRole,
          exp: 0,
          xp: 0,
          onboarding: false,
          created_at: new Date().toISOString(),
        }, { onConflict: "uid" });

        if (insertErr) {
          throw new Error(insertErr.message);
        }

        const emailRes = await sendGreetingEmail({
          toEmail: newUserEmail.trim(),
          toName: newUserName.trim(),
          username: usernameClean,
          password: "user@sydions",
        });

        if (emailRes.success) {
          onShowToast(`User "${newUserName.trim()}" created and greeting email sent!`, "success");
        } else if (emailRes.message.includes("not configured")) {
          onShowToast(`User "${newUserName.trim()}" created successfully!`, "success");
        } else {
          onShowToast(`User created but welcome email failed: ${emailRes.message}`, "error");
        }
      }

      setNewUserName("");
      setNewUserUsername("");
      setNewUserEmail("");
      setNewUserRole("user");
      setEditingUser(null);
      setIsUserModalOpen(false);
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "Failed to save user.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "This email address is already registered in Firebase. Please use a different email.";
      }
      onShowToast(errMsg, "error");
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (_) {}
      }
    } finally {
      setUserCreating(false);
    }
  };

  const handleEditUserClick = (user: any) => {
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserUsername(user.username);
    setNewUserEmail(user.email);
    setNewUserRole(user.role);
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (uid: string, _email?: string) => {
    if (uid === currentUser.uid) {
      onShowToast("You cannot delete your own admin account.", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this user? This will permanently remove their account and all task submissions.")) return;

    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("uid", uid);

      if (error) throw error;

      onShowToast("User deleted successfully!", "success");
      fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      onShowToast(err.message || "Failed to delete user.", "error");
    }
  };

  const handleResetPassword = async (uid: string, username: string) => {
    const isSelf = uid === currentUser.uid;
    const confirmMessage = isSelf
      ? `WARNING: You are resetting your OWN admin password to "user@sydions". You may need to sign in again after resetting. Do you want to proceed?`
      : `Are you sure you want to reset the password for user @${username} to "user@sydions"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const { error } = await supabase.functions.invoke("reset-firebase-password", {
        body: { uid, password: "user@sydions" },
      });

      if (error) throw error;

      onShowToast(
        isSelf 
          ? `Your password has been successfully reset to "user@sydions".` 
          : `Password for @${username} reset to "user@sydions" successfully!`, 
        "success"
      );
    } catch (err: any) {
      console.error("Error resetting password:", err);
      onShowToast(err.message || "Failed to reset password.", "error");
    }
  };

  const handleToggleBanUser = async (user: any) => {
    if (user.uid === currentUser.uid) {
      onShowToast("You cannot ban your own admin account.", "error");
      return;
    }

    if (user.isBanned) {
      if (!window.confirm(`Are you sure you want to unban @${user.username}?`)) return;
      try {
        const { error } = await supabase
          .from("users")
          .update({ is_banned: false, ban_reason: null })
          .eq("uid", user.uid);

        if (error) throw error;
        onShowToast(`User @${user.username} has been unbanned.`, "success");
        fetchUsers();
      } catch (err: any) {
        console.error("Error unbanning user:", err);
        onShowToast(err.message || "Failed to unban user.", "error");
      }
    } else {
      const reason = window.prompt(`Enter the reason for banning @${user.username}:`);
      if (reason === null) return; // Cancelled
      const cleanReason = reason.trim() || "No reason specified by administrator.";

      try {
        const { error } = await supabase
          .from("users")
          .update({ is_banned: true, ban_reason: cleanReason })
          .eq("uid", user.uid);

        if (error) throw error;
        onShowToast(`User @${user.username} has been banned.`, "success");
        fetchUsers();
      } catch (err: any) {
        console.error("Error banning user:", err);
        onShowToast(err.message || "Failed to ban user.", "error");
      }
    }
  };

  const handleToggleSuspendUser = async (user: any) => {
    if (user.uid === currentUser.uid) {
      onShowToast("You cannot suspend your own admin account.", "error");
      return;
    }

    const currentlySuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();

    if (currentlySuspended) {
      if (!window.confirm(`Are you sure you want to revoke the suspension for @${user.username}?`)) return;
      try {
        const { error } = await supabase
          .from("users")
          .update({ suspended_until: null })
          .eq("uid", user.uid);

        if (error) throw error;
        onShowToast(`Suspension for @${user.username} has been revoked.`, "success");
        fetchUsers();
      } catch (err: any) {
        console.error("Error revoking suspension:", err);
        onShowToast(err.message || "Failed to revoke suspension.", "error");
      }
    } else {
      setUserToSuspend(user);
      setSuspendType("day");
      setSuspendDays("0");
      setSuspendHours("0");
      setSuspendMinutes("0");
      setIsSuspendModalOpen(true);
    }
  };

  const handleConfirmSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToSuspend) return;

    const days = Number(suspendDays);
    const hours = Number(suspendHours);
    const minutes = Number(suspendMinutes);

    if (isNaN(days) || isNaN(hours) || isNaN(minutes) || days < 0 || hours < 0 || minutes < 0) {
      onShowToast("Please enter valid positive numbers for duration.", "error");
      return;
    }

    if (suspendType === "hour" && hours >= 24) {
      onShowToast("Hour wise suspension must be less than 24 hours.", "error");
      return;
    }

    const totalMinutes = (suspendType === "day" ? days * 24 * 60 : 0) + (hours * 60) + minutes;

    if (totalMinutes <= 0) {
      onShowToast("Suspension duration must be greater than zero.", "error");
      return;
    }

    const suspendedUntil = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();

    try {
      const { error } = await supabase
        .from("users")
        .update({ suspended_until: suspendedUntil })
        .eq("uid", userToSuspend.uid);

      if (error) throw error;
      onShowToast(`User @${userToSuspend.username} has been suspended.`, "success");
      setIsSuspendModalOpen(false);
      setUserToSuspend(null);
      fetchUsers();
    } catch (err: any) {
      console.error("Error suspending user:", err);
      onShowToast(err.message || "Failed to suspend user.", "error");
    }
  };

  // Job Handlers
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalSteps = jobAssignedType === "all" ? 4 : 5;
    if (jobStep < totalSteps) {
      return;
    }
    if (!jobTitle.trim() || !jobDescription.trim() || !jobDeadline) {
      onShowToast("Job title, description, and deadline are required.", "error");
      return;
    }

    if (jobAssignedType === "specific" && selectedJobUserIds.length === 0) {
      onShowToast("Please select at least one user to assign the job.", "error");
      return;
    }

    const xpVal = Number(jobXPReward);
    if (isNaN(xpVal) || xpVal < 0) {
      onShowToast("Please enter a valid positive XP reward.", "error");
      return;
    }

    if (jobRequiredFields.length === 0) {
      onShowToast("Please select at least one required submission field.", "error");
      return;
    }

    setJobCreating(true);
    try {
      let assignedUserIds: string[] = [];
      if (jobAssignedType === "all") {
        const { data: activeUsers, error: usersErr } = await supabase
          .from("users")
          .select("uid, is_banned, suspended_until")
          .neq("role", "admin");

        if (usersErr) throw usersErr;

        if (activeUsers) {
          const now = new Date();
          let hasSuspended = false;
          assignedUserIds = activeUsers
            .filter((u) => {
              const isBanned = u.is_banned === true;
              const isSuspended = u.suspended_until && new Date(u.suspended_until) > now;
              if (isSuspended) hasSuspended = true;
              return !isBanned && !isSuspended;
            })
            .map((u) => u.uid);

          if (hasSuspended && currentUser?.uid) {
            assignedUserIds.push(currentUser.uid);
          }
        }
      } else {
        assignedUserIds = selectedJobUserIds;
      }

      if (editingJob) {
        const { error: updateErr } = await supabase
          .from("jobs")
          .update({
            title: jobTitle.trim(),
            description: jobDescription.trim(),
            deadline: new Date(jobDeadline).toISOString(),
            xp_reward: xpVal,
            assigned_type: jobAssignedType,
            assigned_users: assignedUserIds,
            required_fields: jobRequiredFields,
          })
          .eq("id", editingJob.id);

        if (updateErr) throw updateErr;
        onShowToast("Job updated successfully!", "success");
      } else {
        const { error: insertErr } = await supabase.from("jobs").insert({
          title: jobTitle.trim(),
          description: jobDescription.trim(),
          deadline: new Date(jobDeadline).toISOString(),
          xp_reward: xpVal,
          assigned_type: jobAssignedType,
          assigned_users: assignedUserIds,
          required_fields: jobRequiredFields,
          created_by_id: currentUser.uid,
          created_at: new Date().toISOString(),
          status: "active",
        });

        if (insertErr) throw insertErr;
        onShowToast("Job created successfully!", "success");
      }

      closeJobModal();
      fetchJobs();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Failed to save job.", "error");
    } finally {
      setJobCreating(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobId);

      if (error) throw error;
      onShowToast("Job deleted successfully!", "success");
      fetchJobs();
    } catch (err: any) {
      console.error("Error deleting job:", err);
      onShowToast(err.message || "Failed to delete job.", "error");
    }
  };

  const handleEditJobClick = (job: any) => {
    setEditingJob(job);
    setJobTitle(job.title);
    setJobDescription(job.description);

    const deadlineDate = new Date(job.deadline.toDate());
    setSelectedJobCalendarDate(deadlineDate);
    setJobCalendarHour(String(deadlineDate.getHours()).padStart(2, '0'));
    setJobCalendarMinute(String(deadlineDate.getMinutes()).padStart(2, '0'));

    const year = deadlineDate.getFullYear();
    const month = String(deadlineDate.getMonth() + 1).padStart(2, "0");
    const day = String(deadlineDate.getDate()).padStart(2, "0");
    const hoursStr = String(deadlineDate.getHours()).padStart(2, "0");
    const minutesStr = String(deadlineDate.getMinutes()).padStart(2, "0");
    setJobDeadline(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);

    setJobAssignedType(job.assignedType);
    setSelectedJobUserIds(job.assignedUsers || []);
    setJobXPReward(String(job.xpReward));
    setJobRequiredFields(job.requiredFields || ["textarea"]);
    setJobStep(1);
    setIsJobModalOpen(true);
    setIsJobCalendarPopupOpen(false);
  };

  const fetchModalJobSubmissions = async () => {
    if (!selectedJobForSubmissions) return;
    setModalJobSubmissionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_submissions")
        .select("*")
        .eq("job_id", selectedJobForSubmissions.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setModalJobSubmissions((data || []).map(mapJobSubmission));
    } catch (err) {
      console.error("Error fetching job submissions:", err);
    } finally {
      setModalJobSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (isJobSubmissionsModalOpen && selectedJobForSubmissions) {
      fetchModalJobSubmissions();
    }
  }, [isJobSubmissionsModalOpen, selectedJobForSubmissions]);

  const handleJobSubmissionAction = async (sub: any, action: "approve" | "reject") => {
    try {
      if (action === "approve") {
        const jobData = jobsList.find((j) => j.id === sub.jobId);
        if (!jobData) {
          onShowToast("Referenced job not found.", "error");
          return;
        }

        const xpAwarded = jobData.xpReward || 0;

        // 1. Update job submission
        const { error: subErr } = await supabase
          .from("job_submissions")
          .update({
            status: "approved",
            xp_awarded: xpAwarded,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", sub.id);

        if (subErr) throw subErr;

        // 2. Update user's aggregate XP
        if (xpAwarded > 0) {
          const { data: userData, error: fetchErr } = await supabase
            .from("users")
            .select("xp")
            .eq("uid", sub.userId)
            .maybeSingle();

          if (fetchErr) throw fetchErr;

          const currentXp = userData?.xp || 0;
          const { error: userErr } = await supabase
            .from("users")
            .update({ xp: currentXp + xpAwarded })
            .eq("uid", sub.userId);

          if (userErr) throw userErr;
        }

        onShowToast(`Job approved! Awarded ${xpAwarded} XP to ${sub.userName}.`, "success");
      } else {
        const { error: subErr } = await supabase
          .from("job_submissions")
          .update({
            status: "rejected",
            xp_awarded: 0,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", sub.id);

        if (subErr) throw subErr;
        onShowToast("Job submission rejected.", "success");
      }
      fetchModalJobSubmissions();
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Failed to process job submission.", "error");
    }
  };

  const updateJobDeadlineFromCalendar = (date: Date | null, hr: string, min: string) => {
    if (!date) return;
    const finalDate = new Date(date);
    let hourNum = parseInt(hr, 10);
    if (isNaN(hourNum) || hourNum < 0) hourNum = 0;
    if (hourNum > 23) hourNum = 23;
    let minNum = parseInt(min, 10);
    if (isNaN(minNum) || minNum < 0) minNum = 0;
    if (minNum > 59) minNum = 59;
    
    finalDate.setHours(hourNum);
    finalDate.setMinutes(minNum);
    finalDate.setSeconds(0);
    finalDate.setMilliseconds(0);
    
    const year = finalDate.getFullYear();
    const month = String(finalDate.getMonth() + 1).padStart(2, "0");
    const day = String(finalDate.getDate()).padStart(2, "0");
    const hoursStr = String(finalDate.getHours()).padStart(2, "0");
    const minutesStr = String(finalDate.getMinutes()).padStart(2, "0");
    
    setJobDeadline(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);
  };

  // Create Task Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalSteps = taskAssignedType === "all" ? 4 : 5;
    if (taskStep < totalSteps) {
      return;
    }
    if (!taskTitle.trim() || !taskDescription.trim() || !taskDeadline) {
      onShowToast("Task title, description, and deadline date-time are required.", "error");
      return;
    }

    if (taskAssignedType === "specific" && selectedUserIds.length === 0) {
      onShowToast("Please select at least one user to assign the task.", "error");
      return;
    }

    const xpVal = Number(maxXP);
    if (isNaN(xpVal) || xpVal <= 0) {
      onShowToast("Please enter a valid positive Max EXP reward.", "error");
      return;
    }

    if (requiredFields.length === 0) {
      onShowToast("Please select at least one required submission field.", "error");
      return;
    }

    setTaskCreating(true);
    try {
      let assignedUserIds: string[] = [];
      if (taskAssignedType === "all") {
        const { data: activeUsers, error: usersErr } = await supabase
          .from("users")
          .select("uid, is_banned, suspended_until")
          .neq("role", "admin");

        if (usersErr) throw usersErr;

        if (activeUsers) {
          const now = new Date();
          let hasSuspended = false;
          assignedUserIds = activeUsers
            .filter((u) => {
              const isBanned = u.is_banned === true;
              const isSuspended = u.suspended_until && new Date(u.suspended_until) > now;
              if (isSuspended) hasSuspended = true;
              return !isBanned && !isSuspended;
            })
            .map((u) => u.uid);

          if (hasSuspended && currentUser?.uid) {
            assignedUserIds.push(currentUser.uid);
          }
        }
      } else {
        assignedUserIds = selectedUserIds;
      }

      if (editingTask) {
        const { error: updateErr } = await supabase
          .from("tasks")
          .update({
            title: taskTitle.trim(),
            description: taskDescription.trim(),
            deadline: new Date(taskDeadline).toISOString(),
            max_xp: xpVal,
            xp_reward: Number(taskXPReward) || 0,
            assigned_type: taskAssignedType,
            assigned_users: assignedUserIds,
            required_fields: requiredFields,
          })
          .eq("id", editingTask.id);

        if (updateErr) {
          throw new Error(updateErr.message);
        }

        onShowToast("Task updated successfully!", "success");
      } else {
        const { error: insertErr } = await supabase.from("tasks").insert({
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          deadline: new Date(taskDeadline).toISOString(),
          max_xp: xpVal,
          xp_reward: Number(taskXPReward) || 0,
          assigned_type: taskAssignedType,
          assigned_users: assignedUserIds,
          required_fields: requiredFields,
          created_by_id: currentUser.uid,
          created_at: new Date().toISOString(),
          status: "active",
        });

        if (insertErr) {
          throw new Error(insertErr.message);
        }

        onShowToast("Task created and assigned successfully!", "success");

        // Trigger task assignment emails asynchronously to avoid blocking the UI
        try {
          const taskTitleVal = taskTitle.trim();
          const deadlineStr = new Date(taskDeadline).toLocaleString();
          let usersToNotify: { email: string; name: string }[] = [];

          if (assignedUserIds.length > 0) {
            const { data: usersData } = await supabase
              .from("users")
              .select("email, name")
              .in("uid", assignedUserIds);
            if (usersData) {
              usersToNotify = usersData;
            }
          }

          usersToNotify.forEach(async (u) => {
            if (u.email) {
              try {
                await sendTaskAssignmentEmail({
                  toEmail: u.email,
                  toName: u.name || "User",
                  taskTitle: taskTitleVal,
                  taskDeadline: deadlineStr,
                });
              } catch (mailErr) {
                console.error(`Failed to send task email to ${u.email}:`, mailErr);
              }
            }
          });
        } catch (emailTriggerErr) {
          console.error("Error triggering assignment emails:", emailTriggerErr);
        }
      }

      setTaskTitle("");
      setTaskDescription("");
      setTaskDeadline("");
      setTaskAssignedType("all");
      setSelectedUserIds([]);
      setMaxXP("500");
      setTaskXPReward("0");
      setRequiredFields(["textarea"]);
      setUserSearchQuery("");
      setEditingTask(null);
      setIsTaskModalOpen(false);
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Failed to save task.", "error");
    } finally {
      setTaskCreating(false);
    }
  };

  // Delete Task Handler
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);
      
      if (error) throw error;
      onShowToast("Task deleted successfully!", "success");
      fetchTasks();
    } catch (err: any) {
      console.error("Error deleting task:", err);
      onShowToast(err.message || "Failed to delete task.", "error");
    }
  };

  // Edit Task Handler
  const handleEditClick = (task: any) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    
    const deadlineDate = new Date(task.deadline.toDate());
    setSelectedCalendarDate(deadlineDate);
    setCalendarHour(String(deadlineDate.getHours()).padStart(2, '0'));
    setCalendarMinute(String(deadlineDate.getMinutes()).padStart(2, '0'));
    
    const year = deadlineDate.getFullYear();
    const month = String(deadlineDate.getMonth() + 1).padStart(2, "0");
    const day = String(deadlineDate.getDate()).padStart(2, "0");
    const hoursStr = String(deadlineDate.getHours()).padStart(2, "0");
    const minutesStr = String(deadlineDate.getMinutes()).padStart(2, "0");
    setTaskDeadline(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);
    
    setTaskAssignedType(task.assignedType);
    setSelectedUserIds(task.assignedUsers || []);
    setMaxXP(String(task.maxXP));
    setTaskXPReward(String(task.xpReward || 0));
    setRequiredFields(task.requiredFields || ["textarea"]);
    setUserSearchQuery("");
    setTaskStep(1);
    setIsTaskModalOpen(true);
    setIsCalendarPopupOpen(false);
  };


  // Handle Submission Actions: Approve or Reject
  const handleSubmissionAction = async (submission: any, action: "approve" | "reject") => {
    try {
      if (action === "approve") {
        // 1. Get task information to verify the assignment type and maxXP
        const taskData = tasksList.find((t) => t.id === submission.taskId);

        if (!taskData) {
          onShowToast("Referenced task not found.", "error");
          return;
        }

        let xpAwarded = 0;

        // XP rewards apply for all tasks with a non-zero maxXP pool
        if (taskData.maxXP > 0) {
          // Get the number of previously approved submissions for this task in Supabase
          const { count, error: countErr } = await supabase
            .from("submissions")
            .select("*", { count: "exact", head: true })
            .eq("task_id", submission.taskId)
            .eq("status", "approved");

          if (countErr) {
            throw new Error(countErr.message);
          }

          const approvedCount = count || 0;

          // Formula: 5% reduction per previous approval
          const discount = 0.05 * approvedCount;
          const discountFactor = Math.min(discount, 1.0);
          xpAwarded = Math.round(taskData.maxXP * (1 - discountFactor));
        }

        const levelXpAwarded = taskData.xpReward || 0;

        // 2. Update submission in Supabase
        const { error: subErr } = await supabase
          .from("submissions")
          .update({
            status: "approved",
            xp_awarded: xpAwarded,
            level_xp_awarded: levelXpAwarded,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", submission.id);

        if (subErr) throw new Error(subErr.message);

        // 3. Update user's aggregate EXP and XP in Supabase
        if (xpAwarded > 0 || levelXpAwarded > 0) {
          const { data: userData, error: fetchErr } = await supabase
            .from("users")
            .select("exp, xp")
            .eq("uid", submission.userId)
            .maybeSingle();

          if (fetchErr) throw new Error(fetchErr.message);

          const currentExp = userData?.exp || 0;
          const currentXp = userData?.xp || 0;
          const { error: userErr } = await supabase
            .from("users")
            .update({ 
              exp: currentExp + xpAwarded,
              xp: currentXp + levelXpAwarded
            })
            .eq("uid", submission.userId);

          if (userErr) throw new Error(userErr.message);
        }

        let toastMessage = `Submission approved! Awarded ${xpAwarded} EXP`;
        if (levelXpAwarded > 0) {
          toastMessage += ` and ${levelXpAwarded} XP`;
        }
        toastMessage += ` to ${submission.userName}.`;
        onShowToast(toastMessage, "success");
      } else {
        // Reject submission in Supabase
        const { error: subErr } = await supabase
          .from("submissions")
          .update({
            status: "rejected",
            xp_awarded: 0,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", submission.id);

        if (subErr) throw new Error(subErr.message);
        onShowToast(`Submission rejected. No EXP awarded.`, "success");
      }
      fetchModalSubmissionsAndRatings();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Failed to process submission.", "error");
    }
  };

  const handleUserCheckboxChange = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const filteredUsers = usersList.filter(user => 
    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(user => selectedUserIds.includes(user.uid));
  
  const handleSelectAllToggle = () => {
    if (allFilteredSelected) {
      const filteredIds = filteredUsers.map(u => u.uid);
      setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredUsers.map(u => u.uid);
      setSelectedUserIds(prev => {
        const newSelection = [...prev];
        filteredIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const openNewTaskModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setCurrentCalendarMonth(tomorrow.getMonth());
    setCurrentCalendarYear(tomorrow.getFullYear());
    setSelectedCalendarDate(null);
    
    setCalendarHour("00");
    setCalendarMinute("00");
    
    setTaskDeadline("");
    
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssignedType("all");
    setSelectedUserIds([]);
    setMaxXP("500");
    setTaskXPReward("0");
    setRequiredFields(["textarea"]);
    setUserSearchQuery("");
    setEditingTask(null);
    
    setTaskStep(1);
    setIsTaskModalOpen(true);
    setIsCalendarPopupOpen(false);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setTaskStep(1);
    setIsCalendarPopupOpen(false);
    setEditingTask(null);
  };

  const openNewJobModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setSelectedJobCalendarDate(null);
    setJobCalendarHour("00");
    setJobCalendarMinute("00");
    setJobDeadline("");
    setJobTitle("");
    setJobDescription("");
    setJobAssignedType("all");
    setSelectedJobUserIds([]);
    setJobXPReward("50");
    setJobRequiredFields(["textarea"]);
    setEditingJob(null);
    setJobStep(1);
    setIsJobModalOpen(true);
    setIsJobCalendarPopupOpen(false);
  };

  const closeJobModal = () => {
    setIsJobModalOpen(false);
    setJobStep(1);
    setIsJobCalendarPopupOpen(false);
    setEditingJob(null);
  };




  // Sort usersList to construct Leaderboard on Overview
  const leaderboardList = [...usersList].sort((a, b) => b.exp - a.exp);

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
          <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/icon.png" alt="Sydions Logo" style={{ width: '26px', height: '26px', display: 'block', flexShrink: 0 }} />
            <ShinyText text="Sydions Portal" speed={3.5} />
          </div>
          <div className="brand-badge">Admin Panel</div>
        </div>
        <div className="nav-user-info">
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
            <div className="nav-user-name">Administrator</div>
            <div className="nav-user-role">{currentUser.email}</div>
          </div>
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
              All Created Tasks
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === "users" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("users");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              User Accounts
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
              className={`sidebar-nav-item ${activeTab === "levels" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("levels");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Levels
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
            <button
              className={`sidebar-nav-item ${activeTab === "quests" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("quests");
                setIsMobileMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Quests
            </button>

          </div>

          <div className="sidebar-footer">
            <button className="btn btn-secondary btn-block btn-sm" onClick={() => {
              onBackToUser();
              setIsMobileMenuOpen(false);
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "0.25rem" }}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>
        </aside>

        {/* Selected Tab Subview Mount Point */}
        <main className="dashboard-main">
          {activeTab === "overview" && (
            <>
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2>
                    <BlurReveal text="Welcome back, Administrator" duration={0.8} />
                  </h2>
                  <p>Check pending approvals, view active rankings, and manage tasks across users.</p>
                </div>
              </div>

              {/* Stats strip */}
              <section className="stats-strip">
                <SpotlightCard className="stat-widget" spotlightColor="rgba(99, 102, 241, 0.12)">
                  <div className="stat-icon-wrapper primary-type">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">
                      <CountUp to={activeTasksCount} duration={1.2} />
                    </span>
                    <span className="stat-label">Active Tasks</span>
                  </div>
                </SpotlightCard>

                <SpotlightCard className="stat-widget" spotlightColor="rgba(20, 184, 166, 0.12)">
                  <div className="stat-icon-wrapper secondary-type">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">
                      <CountUp to={totalUsers} duration={1.2} />
                    </span>
                    <span className="stat-label">Total Users</span>
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
                      <CountUp to={pendingSubmissionsCount} duration={1.2} />
                    </span>
                    <span className="stat-label">Pending Approvals</span>
                  </div>
                </SpotlightCard>
              </section>

              <div style={{ marginTop: "2rem" }}>
                {/* Leaderboard panel on overview */}
                <SpotlightCard className="card" spotlightColor="rgba(20, 184, 166, 0.08)">
                  <div className="card-title-bar">
                    <div className="card-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      Leaderboard Standings
                    </div>
                  </div>

                  <div className="leaderboard-list">
                    {leaderboardList.length === 0 ? (
                      <div className="empty-placeholder">No user rankings.</div>
                    ) : (
                      leaderboardList.map((user, idx) => {
                         const rank = idx + 1;
                         return (
                           <div key={user.uid} className="leaderboard-item">
                             <div className="leaderboard-profile-slot">
                               <span className={`rank-badge rank-${rank <= 3 ? rank : ""}`}>
                                 {rank}
                               </span>
                               <div className="leaderboard-user-details">
                                 <span className="leaderboard-user-name">{user.name}</span>
                                 <span className="leaderboard-user-email">{user.email}</span>
                               </div>
                             </div>
                             <div className="leaderboard-xp-badge">{user.xp} EXP</div>
                           </div>
                         );
                      })
                    )}
                  </div>
                </SpotlightCard>
              </div>
            </>
          )}

          {activeTab === "tasks" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>All Created Tasks</div>
                <button className="btn btn-primary" onClick={openNewTaskModal}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.5rem' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Task
                </button>
              </div>
              <p className="dashboard-view-desc">Monitor task parameters, assignments, and due status.</p>

              {tasksList.length === 0 ? (
                <div className="empty-placeholder">No tasks created yet. Click "New Task" to create one.</div>
              ) : (() => {
                const ITEMS_PER_PAGE = 10;
                const totalTasksPages = Math.ceil(tasksList.length / ITEMS_PER_PAGE);
                const currentTasksPage = Math.min(tasksPage, Math.max(1, totalTasksPages));
                const paginatedTasks = tasksList.slice((currentTasksPage - 1) * ITEMS_PER_PAGE, currentTasksPage * ITEMS_PER_PAGE);
                return (
                  <div className="user-table-wrapper">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Deadline</th>
                          <th>Reward</th>
                          <th>Assignment</th>
                          <th>Status</th>
                          <th>Publish</th>
                          <th>Submissions</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTasks.map((task) => {
                          const isOverdue = new Date(task.deadline.toDate()) < new Date();
                          const taskSubs = allSubmissions.filter((sub) => sub.taskId === task.id);
                          const taskPendingCount = taskSubs.filter((sub) => sub.status === "pending").length;
                          const taskTotalCount = taskSubs.length;
                          return (
                            <tr key={task.id}>
                              <td>
                                <strong>{task.title}</strong>
                              </td>
                              <td>
                                <span className={`task-deadline ${isOverdue ? "urgent" : "upcoming"}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                  {(() => {
                                    const dateObj = new Date(task.deadline.toDate());
                                    const day = String(dateObj.getDate()).padStart(2, '0');
                                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const year = dateObj.getFullYear();
                                    return `${day}/${month}/${year}`;
                                  })()}
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
                                {task.assignedType === "all" ? "Open to All" : `${task.assignedUsers?.length || 0} User(s)`}
                              </td>
                              <td>
                                <span className={`status-capsule ${task.status === 'active' ? 'active' : 'pending'}`}>
                                  {task.status}
                                </span>
                              </td>
                              <td>
                                {(() => {
                                  if (!task.publishedAt) {
                                    return (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem' }}
                                        onClick={() => handlePublishTask(task.id)}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        Publish
                                      </button>
                                    );
                                  }

                                  const pubDate = new Date(task.publishedAt.toDate());
                                  const now = new Date();
                                  const diffMs = now.getTime() - pubDate.getTime();
                                  const diffHours = diffMs / (1000 * 60 * 60);

                                  if (diffHours < 24) {
                                    const remainingMs = (24 * 60 * 60 * 1000) - diffMs;
                                    const remHours = Math.floor(remainingMs / (1000 * 60 * 60));
                                    const remMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                        <span className="status-capsule active" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', width: 'fit-content' }}>
                                          Published
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                          {remHours}h {remMins}m left
                                        </span>
                                        <button
                                          type="button"
                                          style={{ fontSize: '0.65rem', color: 'var(--primary-hover)', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }}
                                          onClick={() => handlePublishTask(task.id)}
                                        >
                                          Re-publish
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                      <span className="status-capsule pending" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--danger)', color: '#fff', width: 'fit-content' }}>
                                        Expired
                                      </span>
                                      <button
                                        type="button"
                                        style={{ fontSize: '0.65rem', color: 'var(--primary-hover)', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handlePublishTask(task.id)}
                                      >
                                        Publish again
                                      </button>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={taskTotalCount === 0}
                                  onClick={() => {
                                    setSelectedTaskForSubmissions(task);
                                    setIsSubmissionsModalOpen(true);
                                  }}
                                >
                                  View ({taskPendingCount} Pnd / {taskTotalCount} Tot)
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    className="action-icon-btn edit-btn"
                                    title="Edit Task"
                                    onClick={() => handleEditClick(task)}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="action-icon-btn delete-btn"
                                    title="Delete Task"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <line x1="10" y1="11" x2="10" y2="17" />
                                      <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <Pagination currentPage={currentTasksPage} totalPages={totalTasksPages} onPageChange={setTasksPage} />
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === "users" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>User Accounts</div>
                <button className="btn btn-primary" onClick={() => {
                  setEditingUser(null);
                  setNewUserName("");
                  setNewUserUsername("");
                  setNewUserEmail("");
                  setNewUserRole("user");
                  setIsUserModalOpen(true);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.5rem' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  New User
                </button>
              </div>
              <p className="dashboard-view-desc">Register new user logins or view registered user lists.</p>

              <div className="user-table-wrapper">
                {usersList.length === 0 ? (
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>EXP Balance</th>
                        <th>XP Balance</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                          No registered users found. Click "New User" to add one.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalUsersPages = Math.ceil(usersList.length / ITEMS_PER_PAGE);
                  const currentUsersPage = Math.min(usersPage, Math.max(1, totalUsersPages));
                  const paginatedUsers = usersList.slice((currentUsersPage - 1) * ITEMS_PER_PAGE, currentUsersPage * ITEMS_PER_PAGE);
                  return (
                    <>
                      <table className="user-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>EXP Balance</th>
                            <th>XP Balance</th>
                            <th style={{ textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedUsers.map((user) => {
                            const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
                            return (
                              <tr key={user.uid} style={{ opacity: (user.isBanned || isSuspended) ? 0.75 : 1 }}>
                                <td>
                                  <strong>{user.name}</strong>
                                  {user.isBanned && (
                                    <span className="brand-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', marginLeft: '0.5rem', fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                                      Banned
                                    </span>
                                  )}
                                  {isSuspended && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <span className="brand-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)', borderColor: 'rgba(245, 158, 11, 0.2)', marginLeft: '0.5rem', fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                                        Suspended
                                      </span>
                                      <CompactSuspensionCountdown suspendedUntil={user.suspendedUntil} />
                                    </div>
                                  )}
                                </td>
                                <td>@{user.username}</td>
                                <td>{user.email}</td>
                                <td>
                                  <span className="brand-badge" style={{ fontSize: "0.6rem", padding: "0.15rem 0.35rem" }}>
                                    {user.role}
                                  </span>
                                </td>
                                <td style={{ color: "var(--primary-hover)", fontWeight: "700" }}>{user.exp} EXP</td>
                                <td style={{ color: "var(--accent-gold)", fontWeight: "700" }}>{user.xp} XP</td>
                                <td>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    position: 'relative',
                                    zIndex: activeUserMenuId === user.uid ? 100 : 1
                                  }}>
                                    <button
                                      type="button"
                                      className="action-icon-btn edit-btn"
                                      title="Actions"
                                      onClick={() => setActiveUserMenuId(activeUserMenuId === user.uid ? null : user.uid)}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="1.5" />
                                        <circle cx="12" cy="5" r="1.5" />
                                        <circle cx="12" cy="19" r="1.5" />
                                      </svg>
                                    </button>
                                    
                                    {activeUserMenuId === user.uid && (
                                      <>
                                        <div 
                                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                                          onClick={() => setActiveUserMenuId(null)}
                                        />
                                        <div style={{
                                          position: 'absolute',
                                          right: 0,
                                          top: '100%',
                                          backgroundColor: 'var(--bg-surface-elevated)',
                                          border: '1px solid var(--border-light)',
                                          borderRadius: 'var(--border-radius-sm)',
                                          boxShadow: 'var(--shadow-lg)',
                                          zIndex: 999,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          minWidth: '170px',
                                          padding: '0.35rem 0',
                                          marginTop: '0.35rem'
                                        }}>
                                          {/* Edit Profile */}
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.625rem',
                                              padding: '0.5rem 1rem',
                                              background: 'none',
                                              border: 'none',
                                              color: 'var(--text-primary)',
                                              fontSize: '0.825rem',
                                              textAlign: 'left',
                                              cursor: 'pointer',
                                              width: '100%',
                                              fontFamily: 'var(--font-sans)',
                                              transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            onClick={() => {
                                              setActiveUserMenuId(null);
                                              handleEditUserClick(user);
                                            }}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            Edit Profile
                                          </button>

                                          {/* Ban/Unban */}
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.625rem',
                                              padding: '0.5rem 1rem',
                                              background: 'none',
                                              border: 'none',
                                              color: user.isBanned ? 'var(--success)' : 'var(--danger)',
                                              fontSize: '0.825rem',
                                              textAlign: 'left',
                                              cursor: 'pointer',
                                              width: '100%',
                                              fontFamily: 'var(--font-sans)',
                                              transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            onClick={() => {
                                              setActiveUserMenuId(null);
                                              handleToggleBanUser(user);
                                            }}
                                          >
                                            {user.isBanned ? (
                                              <>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                                </svg>
                                                Unban User
                                              </>
                                            ) : (
                                              <>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                                Ban User
                                              </>
                                            )}
                                          </button>

                                          {/* Suspend/Revoke */}
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.625rem',
                                              padding: '0.5rem 1rem',
                                              background: 'none',
                                              border: 'none',
                                              color: isSuspended ? 'var(--success)' : 'var(--accent-gold)',
                                              fontSize: '0.825rem',
                                              textAlign: 'left',
                                              cursor: 'pointer',
                                              width: '100%',
                                              fontFamily: 'var(--font-sans)',
                                              transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            onClick={() => {
                                              setActiveUserMenuId(null);
                                              handleToggleSuspendUser(user);
                                            }}
                                          >
                                            {isSuspended ? (
                                              <>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                  <line x1="16" y1="2" x2="16" y2="6" />
                                                  <line x1="8" y1="2" x2="8" y2="6" />
                                                  <line x1="3" y1="10" x2="21" y2="10" />
                                                  <line x1="8" y1="14" x2="16" y2="14" />
                                                </svg>
                                                Revoke Suspend
                                              </>
                                            ) : (
                                              <>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                  <line x1="16" y1="2" x2="16" y2="6" />
                                                  <line x1="8" y1="2" x2="8" y2="6" />
                                                  <line x1="3" y1="10" x2="21" y2="10" />
                                                  <line x1="12" y1="14" x2="12" y2="18" />
                                                  <line x1="10" y1="16" x2="14" y2="16" />
                                                </svg>
                                                Suspend User
                                              </>
                                            )}
                                          </button>

                                          {/* Reset Password */}
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.625rem',
                                              padding: '0.5rem 1rem',
                                              background: 'none',
                                              border: 'none',
                                              color: 'var(--text-primary)',
                                              fontSize: '0.825rem',
                                              textAlign: 'left',
                                              cursor: 'pointer',
                                              width: '100%',
                                              fontFamily: 'var(--font-sans)',
                                              transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            onClick={() => {
                                              setActiveUserMenuId(null);
                                              handleResetPassword(user.uid, user.username);
                                            }}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                            </svg>
                                            Reset Password
                                          </button>

                                          {/* Delete Account */}
                                          <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.625rem',
                                              padding: '0.5rem 1rem',
                                              background: 'none',
                                              border: 'none',
                                              color: 'var(--danger)',
                                              fontSize: '0.825rem',
                                              textAlign: 'left',
                                              cursor: 'pointer',
                                              width: '100%',
                                              fontFamily: 'var(--font-sans)',
                                              transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            onClick={() => {
                                              setActiveUserMenuId(null);
                                              handleDeleteUser(user.uid, user.email);
                                            }}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="3 6 5 6 21 6" />
                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                              <line x1="10" y1="11" x2="10" y2="17" />
                                              <line x1="14" y1="11" x2="14" y2="17" />
                                            </svg>
                                            Delete Account
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <Pagination currentPage={currentUsersPage} totalPages={totalUsersPages} onPageChange={setUsersPage} />
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {activeTab === "leaderboard" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Platform Leaderboard</div>
              </div>
              <p className="dashboard-view-desc">Live ranking of all users based on earned EXP.</p>

              <div className="leaderboard-list" style={{ marginTop: '1.5rem' }}>
                {usersList.length === 0 ? (
                  <div className="empty-placeholder">No user rankings yet.</div>
                ) : (
                  usersList.sort((a, b) => b.exp - a.exp).map((user, idx) => {
                    const rank = idx + 1;
                    return (
                      <div
                        key={user.uid}
                        className="leaderboard-item"
                        style={{
                          padding: '1.25rem 1.5rem',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--border-radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.75rem',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                      >
                        <div className="leaderboard-profile-slot" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <span className={`rank-badge rank-${rank <= 3 ? rank : ""}`} style={{ fontSize: '1.2rem', minWidth: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {rank}
                          </span>
                          <div className="leaderboard-user-details" style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="leaderboard-user-name" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {user.name}
                            </span>
                            <span className="leaderboard-user-email" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              @{user.username}
                            </span>
                          </div>
                        </div>
                        <div className="leaderboard-xp-badge" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-hover)', padding: '0.5rem 1rem', background: 'rgba(99,102,241,0.1)', borderRadius: 'var(--border-radius-full)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span>{user.exp} EXP</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>{user.xp} XP</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {activeTab === "jobs" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Jobs</div>
                <button className="btn btn-primary" onClick={openNewJobModal}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.5rem' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Launch New Job
                </button>
              </div>
              <p className="dashboard-view-desc">Monitor job assignments, details, and completions.</p>

              {jobsList.length === 0 ? (
                <div className="empty-placeholder">No jobs created yet. Click "Launch New Job" to create one.</div>
              ) : (() => {
                const ITEMS_PER_PAGE = 10;
                const totalJobsPages = Math.ceil(jobsList.length / ITEMS_PER_PAGE);
                const currentJobsPage = Math.min(jobsPage, Math.max(1, totalJobsPages));
                const paginatedJobs = jobsList.slice((currentJobsPage - 1) * ITEMS_PER_PAGE, currentJobsPage * ITEMS_PER_PAGE);
                return (
                  <div className="user-table-wrapper">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Deadline</th>
                          <th>XP Reward</th>
                          <th>Assignment</th>
                          <th>Status</th>
                          <th>Submissions</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedJobs.map((job) => {
                          const isOverdue = new Date(job.deadline.toDate()) < new Date();
                          const jobSubs = allJobSubmissions.filter((sub) => sub.jobId === job.id);
                          const jobPendingCount = jobSubs.filter((sub) => sub.status === "pending").length;
                          const jobTotalCount = jobSubs.length;
                          return (
                            <tr key={job.id}>
                              <td>
                                <strong>{job.title}</strong>
                              </td>
                              <td>
                                <span className={`task-deadline ${isOverdue ? "urgent" : "upcoming"}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                  {(() => {
                                    const dateObj = new Date(job.deadline.toDate());
                                    const day = String(dateObj.getDate()).padStart(2, '0');
                                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const year = dateObj.getFullYear();
                                    return `${day}/${month}/${year}`;
                                  })()}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{job.xpReward} XP</span>
                              </td>
                              <td>
                                {job.assignedType === "all" ? "Open to All" : `${job.assignedUsers?.length || 0} User(s)`}
                              </td>
                              <td>
                                <span className={`status-capsule ${job.status === 'active' ? 'active' : 'pending'}`}>
                                  {job.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={jobTotalCount === 0}
                                  onClick={() => {
                                    setSelectedJobForSubmissions(job);
                                    setIsJobSubmissionsModalOpen(true);
                                  }}
                                >
                                  View ({jobPendingCount} Pnd / {jobTotalCount} Tot)
                                </button>
                              </td>
                              <td>
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'center', 
                                  position: 'relative',
                                  zIndex: activeJobMenuId === job.id ? 100 : 1
                                }}>
                                  <button
                                    type="button"
                                    className="action-icon-btn edit-btn"
                                    title="Actions"
                                    onClick={() => setActiveJobMenuId(activeJobMenuId === job.id ? null : job.id)}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="1.5" />
                                      <circle cx="12" cy="5" r="1.5" />
                                      <circle cx="12" cy="19" r="1.5" />
                                    </svg>
                                  </button>
                                  
                                  {activeJobMenuId === job.id && (
                                    <>
                                      <div 
                                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                                        onClick={() => setActiveJobMenuId(null)}
                                      />
                                      <div style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        backgroundColor: 'var(--bg-surface-elevated)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: 'var(--border-radius-sm)',
                                        boxShadow: 'var(--shadow-lg)',
                                        zIndex: 999,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minWidth: '170px',
                                        padding: '0.35rem 0',
                                        marginTop: '0.35rem'
                                      }}>
                                        <button
                                          type="button"
                                          className="dropdown-item"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.625rem',
                                            padding: '0.5rem 1rem',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.825rem',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            width: '100%',
                                            fontFamily: 'var(--font-sans)',
                                            transition: 'background 0.15s ease'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                          onClick={() => {
                                            setActiveJobMenuId(null);
                                            handleEditJobClick(job);
                                          }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                          </svg>
                                          Edit Job
                                        </button>
                                        <button
                                          type="button"
                                          className="dropdown-item"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.625rem',
                                            padding: '0.5rem 1rem',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--danger)',
                                            fontSize: '0.825rem',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            width: '100%',
                                            fontFamily: 'var(--font-sans)',
                                            transition: 'background 0.15s ease'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                          onClick={() => {
                                            setActiveJobMenuId(null);
                                            handleDeleteJob(job.id);
                                          }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            <line x1="10" y1="11" x2="10" y2="17" />
                                            <line x1="14" y1="11" x2="14" y2="17" />
                                          </svg>
                                          Delete Job
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <Pagination currentPage={currentJobsPage} totalPages={totalJobsPages} onPageChange={setJobsPage} />
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === "levels" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Level Management</div>
                <button className="btn btn-primary" onClick={() => {
                  setEditingLevel(null);
                  setLevelName("");
                  setLevelMinXP("0");
                  setLevelMaxXP("");
                  setIsLevelModalOpen(true);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.5rem' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add Level
                </button>
              </div>
              <p className="dashboard-view-desc">Define game levels and their required XP thresholds for user progression.</p>

              {levelsList.length === 0 ? (
                <div className="empty-placeholder">No levels defined yet. Click "Add Level" to create your first level.</div>
              ) : (
                <div className="user-table-wrapper" style={{ marginTop: '1.25rem' }}>
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Level Name</th>
                        <th>Min XP</th>
                        <th>Max XP</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelsList.map((lvl, idx) => (
                        <tr key={lvl.id}>
                          <td><strong style={{ color: 'var(--primary-hover)' }}>{idx + 1}</strong></td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1rem' }}>⚡</span>
                              <strong>{lvl.level_name}</strong>
                            </span>
                          </td>
                          <td><span style={{ color: 'var(--secondary)', fontWeight: 600 }}>{lvl.min_xp} XP</span></td>
                          <td><span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{lvl.max_xp} XP</span></td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="action-icon-btn edit-btn"
                                title="Edit Level"
                                onClick={() => {
                                  setEditingLevel(lvl);
                                  setLevelName(lvl.level_name);
                                  setLevelMinXP(String(lvl.min_xp));
                                  setLevelMaxXP(String(lvl.max_xp));
                                  setIsLevelModalOpen(true);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn"
                                title="Delete Level"
                                style={{ color: 'var(--danger)' }}
                                onClick={async () => {
                                  if (!window.confirm(`Delete level "${lvl.level_name}"?`)) return;
                                  const { error } = await supabase.from("levels").delete().eq("id", lvl.id);
                                  if (error) {
                                    onShowToast("Failed to delete level.", "error");
                                  } else {
                                    onShowToast("Level deleted.", "success");
                                    fetchLevels();
                                  }
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Level visual progression preview */}
              {levelsList.length > 0 && (
                <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'var(--bg-surface)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem' }}>Level Progression Preview</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {levelsList.map((lvl, idx) => {
                      const prevMaxXP = idx === 0 ? 0 : levelsList[idx - 1].max_xp;
                      const range = lvl.max_xp - prevMaxXP;
                      const maxRange = levelsList[levelsList.length - 1].max_xp;
                      const pct = Math.min((range / maxRange) * 100, 100);
                      return (
                        <div key={lvl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '80px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{lvl.level_name}</div>
                          <div style={{ flex: 1, height: '10px', background: 'var(--bg-surface-elevated)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, var(--primary), var(--secondary))`, borderRadius: '99px', transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ width: '70px', fontSize: '0.7rem', color: 'var(--accent-gold)', flexShrink: 0 }}>≤{lvl.max_xp} XP</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "quests" && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="dashboard-view-title" style={{ marginBottom: 0 }}>Quests Management</div>
                <button className="btn btn-primary" onClick={() => {
                  resetQuestFields();
                  setIsQuestModalOpen(true);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.5rem' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Quest
                </button>
              </div>
              <p className="dashboard-view-desc">Create gamified tasks, questionnaires, jobs, and grade user submissions.</p>

              {questsList.length === 0 ? (
                <div className="empty-placeholder">No quests created yet. Click "New Quest" to build one!</div>
              ) : (
                <div className="user-table-wrapper" style={{ marginTop: '1.25rem' }}>
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Requirements</th>
                        <th>Schedule</th>
                        <th>Status</th>
                        <th>Participation</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questsList.map((quest) => {
                        const now = new Date();
                        const start = new Date(quest.start_time);
                        const end = new Date(quest.end_time);
                        let statusText = "Active";
                        let statusClass = "active";
                        if (now < start) {
                          statusText = "Scheduled";
                          statusClass = "pending";
                        } else if (now > end) {
                          statusText = "Expired";
                          statusClass = "expired";
                        }

                        const participants = questParticipants.filter(p => p.quest_id === quest.id);
                        const totalJoined = participants.length;
                        const pendingGrading = participants.filter(p => p.status === "submitted").length;

                        return (
                          <tr key={quest.id}>
                            <td>
                              <strong>{quest.title}</strong>
                            </td>
                            <td>
                              <span className="brand-badge" style={{ textTransform: 'capitalize' }}>{quest.category}</span>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--primary-hover)' }}>{quest.min_exp} EXP</span> / <span style={{ color: 'var(--accent-gold)' }}>{quest.min_xp} XP</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <div style={{ fontSize: '0.65rem' }}>to {end.toLocaleDateString()} {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                            </td>
                            <td>
                              <span className={`status-capsule ${statusClass}`}>
                                {statusText}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedQuestForGrading(quest);
                                  setIsQuestGradingModalOpen(true);
                                  fetchQuestGradingParticipants(quest.id);
                                }}
                              >
                                Grade ({pendingGrading} Pnd / {totalJoined} Tot)
                              </button>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="action-icon-btn edit-btn"
                                  title="Edit Quest"
                                  onClick={() => {
                                    setEditingQuest(quest);
                                    setQuestTitle(quest.title);
                                    setQuestDescription(quest.description);
                                    setQuestCategory(quest.category);
                                    setQuestStartTime(quest.start_time.substring(0, 16));
                                    setQuestEndTime(quest.end_time.substring(0, 16));
                                    setQuestMinExp(String(quest.min_exp));
                                    setQuestMinXp(String(quest.min_xp));
                                    setQuestQuestions(quest.quest_data || []);
                                    setQuestStep(1);
                                    setIsQuestModalOpen(true);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-btn"
                                  title="Delete Quest"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => handleDeleteQuest(quest.id)}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                              </div>
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

        </main>
      </div>

      {/* Level Create/Edit Modal */}
      {isLevelModalOpen && (
        <div className="modal-overlay" onClick={() => setIsLevelModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingLevel ? "Edit Level" : "Add New Level"}</div>
              <button type="button" className="modal-close-btn" onClick={() => setIsLevelModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!levelName.trim() || !levelMaxXP) {
                  onShowToast("Level name and Max XP are required.", "error");
                  return;
                }
                setLevelCreating(true);
                try {
                  const payload = {
                    level_name: levelName.trim(),
                    min_xp: parseInt(levelMinXP, 10) || 0,
                    max_xp: parseInt(levelMaxXP, 10),
                  };
                  if (editingLevel) {
                    const { error } = await supabase.from("levels").update(payload).eq("id", editingLevel.id);
                    if (error) throw error;
                    onShowToast("Level updated successfully!", "success");
                  } else {
                    const { error } = await supabase.from("levels").insert(payload);
                    if (error) throw error;
                    onShowToast("Level created successfully!", "success");
                  }
                  fetchLevels();
                  setIsLevelModalOpen(false);
                } catch (err: any) {
                  onShowToast(err.message || "Failed to save level.", "error");
                } finally {
                  setLevelCreating(false);
                }
              }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="level-name">Level Name</label>
                  <input
                    id="level-name"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Level 1, Rookie, etc."
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="level-min-xp">Min XP (start of level)</label>
                    <input
                      id="level-min-xp"
                      type="number"
                      className="form-control"
                      placeholder="e.g. 0"
                      value={levelMinXP}
                      onChange={(e) => setLevelMinXP(e.target.value)}
                      min={0}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="level-max-xp">Max XP (level up at)</label>
                    <input
                      id="level-max-xp"
                      type="number"
                      className="form-control"
                      placeholder="e.g. 100"
                      value={levelMaxXP}
                      onChange={(e) => setLevelMaxXP(e.target.value)}
                      min={1}
                      required
                    />
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'block', marginTop: '-0.5rem' }}>
                  Users who reach Max XP will automatically level up to the next level.
                </span>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsLevelModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={levelCreating}>
                    {levelCreating ? "Saving..." : editingLevel ? "Save Changes" : "Create Level"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="modal-overlay" onClick={closeTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingTask ? "Edit Task" : "Launch New Task"}</div>
              <button type="button" className="modal-close-btn" onClick={closeTaskModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Stepper Header */}
            {(() => {
              const totalSteps = taskAssignedType === "all" ? 4 : 5;
              const rewardStep = taskAssignedType === "all" ? 3 : 4;
              const formatStep = taskAssignedType === "all" ? 4 : 5;
              return (
                <div className="stepper-container" style={{ marginTop: '1.5rem' }}>
                  <div className="stepper-line-bg"></div>
                  <div className="stepper-line-active" style={{ width: `${((taskStep - 1) / (totalSteps - 1)) * 100}%` }}></div>
                  
                  <div className={`stepper-step ${taskStep === 1 ? "active" : ""} ${taskStep > 1 ? "completed" : ""}`}>
                    <div className="stepper-circle">1</div>
                    <div className="stepper-label">Details</div>
                  </div>
                  <div className={`stepper-step ${taskStep === 2 ? "active" : ""} ${taskStep > 2 ? "completed" : ""}`}>
                    <div className="stepper-circle">2</div>
                    <div className="stepper-label">Settings</div>
                  </div>
                  {taskAssignedType === "specific" && (
                    <div className={`stepper-step ${taskStep === 3 ? "active" : ""} ${taskStep > 3 ? "completed" : ""}`}>
                      <div className="stepper-circle">3</div>
                      <div className="stepper-label">Users</div>
                    </div>
                  )}
                  <div className={`stepper-step ${taskStep === rewardStep ? "active" : ""} ${taskStep > rewardStep ? "completed" : ""}`}>
                    <div className="stepper-circle">{rewardStep}</div>
                    <div className="stepper-label">Rewards</div>
                  </div>
                  <div className={`stepper-step ${taskStep === formatStep ? "active" : ""}`}>
                    <div className="stepper-circle">{formatStep}</div>
                    <div className="stepper-label">Format</div>
                  </div>
                </div>
              );
            })()}

            <div className="modal-body" style={{ paddingTop: '0.5rem' }}>
              <form onSubmit={handleCreateTask}>
                
                {/* Step 1 Content: Task Details */}
                {taskStep === 1 && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="task-title">Task Title</label>
                      <input
                        id="task-title"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Implement OEE calculation logic"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="task-desc">Description & Instructions</label>
                      <textarea
                        id="task-desc"
                        className="form-control"
                        placeholder="Describe the task details, deadline info, and submission requirements here..."
                        rows={6}
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        required
                        style={{ resize: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {/* Step 2 Content: Target & Deadline (Calendar UI) */}
                {taskStep === 2 && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
                    <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
                      <label className="form-label">Deadline Date & Time</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ paddingRight: '40px', cursor: 'pointer' }}
                          readOnly
                           value={
                            selectedCalendarDate
                              ? `${selectedCalendarDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${calendarHour.padStart(2, '0')}:${calendarMinute.padStart(2, '0')}`
                              : ""
                          }
                          placeholder="Select deadline date & time..."
                          onClick={() => setIsCalendarPopupOpen(!isCalendarPopupOpen)}
                          required
                        />
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </div>


                      {/* Removed Popup Popover for Calendar */}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Assignment Mode</label>
                      <div className="toggle-btn-group" style={{ marginBottom: 0 }}>
                        <button
                          type="button"
                          className={`toggle-option ${taskAssignedType === "all" ? "active" : ""}`}
                          onClick={() => {
                            setTaskAssignedType("all");
                            setSelectedUserIds([]);
                          }}
                        >
                          All Users
                        </button>
                        <button
                          type="button"
                          className={`toggle-option ${taskAssignedType === "specific" ? "active" : ""}`}
                          onClick={() => setTaskAssignedType("specific")}
                        >
                          Specific Users
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Assignment Table (Specific users only) */}
                {taskStep === 3 && taskAssignedType === "specific" && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Select Assigned Users</label>
                      
                      {/* Search Input */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search users by name, username or email..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        />
                      </div>

                      {usersList.length === 0 ? (
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem" }}>
                          No users available. Create a user account first in User Accounts tab.
                        </p>
                      ) : (
                        <div className="user-table-wrapper" style={{ maxHeight: "200px", overflowY: 'auto' }}>
                          <table className="user-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '40px', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>
                                  <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={handleSelectAllToggle}
                                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                  />
                                </th>
                                <th style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>Username</th>
                                <th style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>Email</th>
                                <th style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>EXP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                                    No users match search query.
                                  </td>
                                </tr>
                              ) : (
                                filteredUsers.map((user) => (
                                  <tr key={user.uid}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedUserIds.includes(user.uid)}
                                        onChange={() => handleUserCheckboxChange(user.uid)}
                                        style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <strong>{user.name}</strong>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>{user.email}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--primary-hover)' }}>{user.exp} EXP</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Selected: {selectedUserIds.length} user(s)
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 (All users) or Step 4 (Specific users): Rewards Pool */}
                {((taskStep === 3 && taskAssignedType === "all") || (taskStep === 4 && taskAssignedType === "specific")) && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="task-xp">Max EXP Reward Pool</label>
                      <input
                        id="task-xp"
                        type="number"
                        className="form-control"
                        placeholder="e.g. 500"
                        value={maxXP}
                        onChange={(e) => setMaxXP(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem", display: "inline-block", lineHeight: '1.4' }}>
                        {taskAssignedType === "all" ? (
                          "Notice: All users can view and attempt this task. The first user to submit receives the full reward, while subsequent users get their rewards reduced by 5% per previous approval."
                        ) : (
                          "Notice: Only the selected users can view and attempt this task. They will receive the reward pool specified above upon task completion approval."
                        )}
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="task-xp-reward">Optional Leveling XP Reward</label>
                      <input
                        id="task-xp-reward"
                        type="number"
                        className="form-control"
                        placeholder="e.g. 50"
                        value={taskXPReward}
                        onChange={(e) => setTaskXPReward(e.target.value)}
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem", display: "inline-block", lineHeight: '1.4' }}>
                        Leveling points awarded directly to the user's permanent XP balance upon task approval.
                      </span>
                    </div>
                  </div>
                )}

                {/* Step 4 (All users) or Step 5 (Specific users): Submission Format */}
                {((taskStep === 4 && taskAssignedType === "all") || (taskStep === 5 && taskAssignedType === "specific")) && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ marginBottom: "0.25rem" }}>Required Deliverables</label>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "1rem" }}>
                        Specify one or multiple deliverable formats that users must submit to complete this task.
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={requiredFields.includes("text")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRequiredFields(prev => [...prev, "text"]);
                              } else {
                                setRequiredFields(prev => prev.filter(f => f !== "text"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Short Answer (Textbox)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={requiredFields.includes("textarea")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRequiredFields(prev => [...prev, "textarea"]);
                              } else {
                                setRequiredFields(prev => prev.filter(f => f !== "textarea"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Detailed Solution (Textarea)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={requiredFields.includes("link")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRequiredFields(prev => [...prev, "link"]);
                              } else {
                                setRequiredFields(prev => prev.filter(f => f !== "link"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Resource Link (URL)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={requiredFields.includes("upload")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRequiredFields(prev => [...prev, "upload"]);
                              } else {
                                setRequiredFields(prev => prev.filter(f => f !== "upload"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          File Attachment (Max 5MB / Auto-compressed images)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stepper Footer Controls */}
                {(() => {
                  const totalSteps = taskAssignedType === "all" ? 4 : 5;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <div>
                        {taskStep > 1 && (
                          <button key="back-btn" type="button" className="btn btn-secondary" onClick={() => { setIsCalendarPopupOpen(false); setTaskStep(prev => prev - 1); }}>
                            Back
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button key="cancel-btn" type="button" className="btn btn-secondary" onClick={closeTaskModal}>
                          Cancel
                        </button>
                        {taskStep < totalSteps ? (
                          <button
                            key="next-btn"
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              if (taskStep === 1) {
                                  if (!taskTitle.trim() || !taskDescription.trim()) {
                                    onShowToast("Task title and description are required.", "error");
                                    return;
                                  }
                              } else if (taskStep === 2) {
                                if (!taskDeadline) {
                                  onShowToast("Task deadline date & time are required.", "error");
                                  return;
                                }
                              } else if (taskStep === 3 && taskAssignedType === "specific") {
                                if (selectedUserIds.length === 0) {
                                  onShowToast("Please select at least one user to assign the task.", "error");
                                  return;
                                }
                              }
                              setIsCalendarPopupOpen(false);
                              setTaskStep(prev => prev + 1);
                            }}
                          >
                            Next
                          </button>
                        ) : (
                          <button key="submit-btn" type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }} disabled={taskCreating}>
                            {taskCreating ? (editingTask ? "Saving..." : "Launching...") : (editingTask ? "Save Changes" : "Publish Task")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Job Creation Modal */}
      {isJobModalOpen && (
        <div className="modal-overlay" onClick={closeJobModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingJob ? "Edit Job" : "Launch New Job"}</div>
              <button type="button" className="modal-close-btn" onClick={closeJobModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Stepper Header */}
            {(() => {
              const totalSteps = jobAssignedType === "all" ? 4 : 5;
              const rewardStep = jobAssignedType === "all" ? 3 : 4;
              const formatStep = jobAssignedType === "all" ? 4 : 5;
              return (
                <div className="stepper-container" style={{ marginTop: '1.5rem' }}>
                  <div className="stepper-line-bg"></div>
                  <div className="stepper-line-active" style={{ width: `${((jobStep - 1) / (totalSteps - 1)) * 100}%` }}></div>
                  
                  <div className={`stepper-step ${jobStep === 1 ? "active" : ""} ${jobStep > 1 ? "completed" : ""}`}>
                    <div className="stepper-circle">1</div>
                    <div className="stepper-label">Details</div>
                  </div>
                  <div className={`stepper-step ${jobStep === 2 ? "active" : ""} ${jobStep > 2 ? "completed" : ""}`}>
                    <div className="stepper-circle">2</div>
                    <div className="stepper-label">Settings</div>
                  </div>
                  {jobAssignedType === "specific" && (
                    <div className={`stepper-step ${jobStep === 3 ? "active" : ""} ${jobStep > 3 ? "completed" : ""}`}>
                      <div className="stepper-circle">3</div>
                      <div className="stepper-label">Users</div>
                    </div>
                  )}
                  <div className={`stepper-step ${jobStep === rewardStep ? "active" : ""} ${jobStep > rewardStep ? "completed" : ""}`}>
                    <div className="stepper-circle">{rewardStep}</div>
                    <div className="stepper-label">Rewards</div>
                  </div>
                  <div className={`stepper-step ${jobStep === formatStep ? "active" : ""}`}>
                    <div className="stepper-circle">{formatStep}</div>
                    <div className="stepper-label">Format</div>
                  </div>
                </div>
              );
            })()}

            <div className="modal-body" style={{ paddingTop: '0.5rem' }}>
              <form onSubmit={handleCreateJob}>
                
                {/* Step 1 Content: Job Details */}
                {jobStep === 1 && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="job-title">Job Title</label>
                      <input
                        id="job-title"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Complete manual verification of backups"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="job-desc">Description & Instructions</label>
                      <textarea
                        id="job-desc"
                        className="form-control"
                        placeholder="Describe the job details, instructions, and required information here..."
                        rows={6}
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        required
                        style={{ resize: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {/* Step 2 Content: Target & Deadline (Calendar UI) */}
                {jobStep === 2 && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
                    <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
                      <label className="form-label">Deadline Date & Time</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ paddingRight: '40px', cursor: 'pointer' }}
                          readOnly
                          value={
                            selectedJobCalendarDate
                              ? `${selectedJobCalendarDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${jobCalendarHour.padStart(2, '0')}:${jobCalendarMinute.padStart(2, '0')}`
                              : ""
                          }
                          placeholder="Select deadline date & time..."
                          onClick={() => setIsJobCalendarPopupOpen(!isJobCalendarPopupOpen)}
                          required
                        />
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Assignment Mode</label>
                      <div className="toggle-btn-group" style={{ marginBottom: 0 }}>
                        <button
                          type="button"
                          className={`toggle-option ${jobAssignedType === "all" ? "active" : ""}`}
                          onClick={() => {
                            setJobAssignedType("all");
                            setSelectedJobUserIds([]);
                          }}
                        >
                          All Users
                        </button>
                        <button
                          type="button"
                          className={`toggle-option ${jobAssignedType === "specific" ? "active" : ""}`}
                          onClick={() => setJobAssignedType("specific")}
                        >
                          Specific Users
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Assignment Table (Specific users only) */}
                {jobStep === 3 && jobAssignedType === "specific" && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Select Assigned Users</label>
                      
                      {/* Search Input */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search users by name, username or email..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        />
                      </div>

                      {usersList.length === 0 ? (
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem" }}>
                          No users available. Create a user account first in User Accounts tab.
                        </p>
                      ) : (
                        <div className="user-table-wrapper" style={{ maxHeight: "200px", overflowY: 'auto' }}>
                          <table className="user-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '40px', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>
                                  <input
                                    type="checkbox"
                                    checked={filteredUsers.length > 0 && filteredUsers.every(user => selectedJobUserIds.includes(user.uid))}
                                    onChange={() => {
                                      const filteredIds = filteredUsers.map(u => u.uid);
                                      const allSel = filteredUsers.length > 0 && filteredUsers.every(user => selectedJobUserIds.includes(user.uid));
                                      if (allSel) {
                                        setSelectedJobUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
                                      } else {
                                        setSelectedJobUserIds(prev => {
                                          const newSelection = [...prev];
                                          filteredIds.forEach(id => {
                                            if (!newSelection.includes(id)) {
                                              newSelection.push(id);
                                            }
                                          });
                                          return newSelection;
                                        });
                                      }
                                    }}
                                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                  />
                                </th>
                                <th style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>Username</th>
                                <th style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>Email</th>
                                <th style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-base)' }}>XP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                                    No users match search query.
                                  </td>
                                </tr>
                              ) : (
                                filteredUsers.map((user) => (
                                  <tr key={user.uid}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedJobUserIds.includes(user.uid)}
                                        onChange={() => {
                                          setSelectedJobUserIds(prev =>
                                            prev.includes(user.uid) ? prev.filter(id => id !== user.uid) : [...prev, user.uid]
                                          );
                                        }}
                                        style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <strong>{user.name}</strong>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>{user.email}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--accent-gold)' }}>{user.xp} XP</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Selected: {selectedJobUserIds.length} user(s)
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 (All users) or Step 4 (Specific users): Rewards Pool */}
                {((jobStep === 3 && jobAssignedType === "all") || (jobStep === 4 && jobAssignedType === "specific")) && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="job-xp">XP Reward</label>
                      <input
                        id="job-xp"
                        type="number"
                        className="form-control"
                        placeholder="e.g. 50"
                        value={jobXPReward}
                        onChange={(e) => setJobXPReward(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem", display: "inline-block", lineHeight: '1.4' }}>
                        Leveling points awarded directly to the user's permanent XP balance upon job approval.
                      </span>
                    </div>
                  </div>
                )}

                {/* Step 4 (All users) or Step 5 (Specific users): Submission Format */}
                {((jobStep === 4 && jobAssignedType === "all") || (jobStep === 5 && jobAssignedType === "specific")) && (
                  <div className="stepper-content-body" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ marginBottom: "0.25rem" }}>Required Deliverables</label>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "1rem" }}>
                        Specify one or multiple deliverable formats that users must submit to complete this job.
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={jobRequiredFields.includes("text")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setJobRequiredFields(prev => [...prev, "text"]);
                              } else {
                                setJobRequiredFields(prev => prev.filter(f => f !== "text"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Short Answer (Textbox)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={jobRequiredFields.includes("textarea")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setJobRequiredFields(prev => [...prev, "textarea"]);
                              } else {
                                setJobRequiredFields(prev => prev.filter(f => f !== "textarea"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Detailed Solution (Textarea)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={jobRequiredFields.includes("link")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setJobRequiredFields(prev => [...prev, "link"]);
                              } else {
                                setJobRequiredFields(prev => prev.filter(f => f !== "link"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Resource Link (URL)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={jobRequiredFields.includes("upload")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setJobRequiredFields(prev => [...prev, "upload"]);
                              } else {
                                setJobRequiredFields(prev => prev.filter(f => f !== "upload"));
                              }
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          File Attachment (Max 5MB / Auto-compressed images)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stepper Footer Controls */}
                {(() => {
                  const totalSteps = jobAssignedType === "all" ? 4 : 5;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <div>
                        {jobStep > 1 && (
                          <button key="job-back-btn" type="button" className="btn btn-secondary" onClick={() => { setIsJobCalendarPopupOpen(false); setJobStep(prev => prev - 1); }}>
                            Back
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button key="job-cancel-btn" type="button" className="btn btn-secondary" onClick={closeJobModal}>
                          Cancel
                        </button>
                        {jobStep < totalSteps ? (
                          <button
                            key="job-next-btn"
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              if (jobStep === 1) {
                                  if (!jobTitle.trim() || !jobDescription.trim()) {
                                    onShowToast("Job title and description are required.", "error");
                                    return;
                                  }
                              } else if (jobStep === 2) {
                                if (!jobDeadline) {
                                  onShowToast("Job deadline date & time are required.", "error");
                                  return;
                                }
                              } else if (jobStep === 3 && jobAssignedType === "specific") {
                                if (selectedJobUserIds.length === 0) {
                                  onShowToast("Please select at least one user to assign the job.", "error");
                                  return;
                                }
                              }
                              setIsJobCalendarPopupOpen(false);
                              setJobStep(prev => prev + 1);
                            }}
                          >
                            Next
                          </button>
                        ) : (
                          <button key="job-submit-btn" type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }} disabled={jobCreating}>
                            {jobCreating ? (editingJob ? "Saving..." : "Launching...") : (editingJob ? "Save Changes" : "Launch Job")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Job Submissions Modal */}
      {isJobSubmissionsModalOpen && selectedJobForSubmissions && (
        <div className="modal-overlay" onClick={() => { setIsJobSubmissionsModalOpen(false); setModalJobTab("pending"); }}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div className="modal-title">Submissions: {selectedJobForSubmissions.title}</div>
              <button type="button" className="modal-close-btn" onClick={() => { setIsJobSubmissionsModalOpen(false); setModalJobTab("pending"); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '1rem', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', marginTop: '1rem' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: modalJobTab === "pending" ? '2px solid var(--primary)' : '2px solid transparent',
                  color: modalJobTab === "pending" ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '0.5rem 0.25rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
                onClick={() => setModalJobTab("pending")}
              >
                Pending Approvals ({modalJobSubmissions.filter(s => s.status === 'pending').length})
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: modalJobTab === "approved" ? '2px solid var(--primary)' : '2px solid transparent',
                  color: modalJobTab === "approved" ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '0.5rem 0.25rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
                onClick={() => setModalJobTab("approved")}
              >
                Approved ({modalJobSubmissions.filter(s => s.status === 'approved').length})
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1.5rem' }}>
              {modalJobSubmissionsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                </div>
              ) : modalJobTab === "pending" ? (
                modalJobSubmissions.filter(sub => sub.status === 'pending').length === 0 ? (
                  <div className="empty-placeholder">
                    No pending submissions for this job.
                  </div>
                ) : (
                  <div className="pending-submissions-list">
                    {modalJobSubmissions
                      .filter(sub => sub.status === 'pending')
                      .sort((a, b) => new Date(a.submittedAt.toDate()).getTime() - new Date(b.submittedAt.toDate()).getTime())
                      .map((sub, index) => {
                        const isGradingDisabled = index > 0;
                        return (
                          <div key={sub.id} className="submission-item-row" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', marginBottom: '1rem', opacity: isGradingDisabled ? 0.7 : 1 }}>
                            <div className="submission-meta" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', marginRight: '2rem' }}>
                              <div className="submission-user-info" style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="submission-user-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{sub.userName}</span>
                                <span className="submission-user-email" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sub.userEmail}</span>
                              </div>
                              <span className="submission-submitted-at" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Submitted: {new Date(sub.submittedAt.toDate()).toLocaleString()}
                              </span>
                              <div className="submission-content-box" style={{ marginTop: '0.5rem', width: '100%', maxWidth: '800px' }}>{renderSubmissionContent(sub.content)}</div>
                            </div>
                            <div className="submission-actions-row" style={{ flexShrink: 0, gap: '0.75rem', display: 'flex', flexDirection: 'column', minWidth: '110px' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ backgroundColor: isGradingDisabled ? 'var(--text-muted)' : "var(--success)", width: '100%', cursor: isGradingDisabled ? 'not-allowed' : 'pointer' }}
                                disabled={isGradingDisabled}
                                title={isGradingDisabled ? "Please grade older submissions first" : ""}
                                onClick={() => handleJobSubmissionAction(sub, "approve")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ borderColor: isGradingDisabled ? 'var(--border-color)' : "var(--danger)", color: isGradingDisabled ? 'var(--text-muted)' : "var(--danger)", width: '100%', cursor: isGradingDisabled ? 'not-allowed' : 'pointer' }}
                                disabled={isGradingDisabled}
                                title={isGradingDisabled ? "Please grade older submissions first" : ""}
                                onClick={() => handleJobSubmissionAction(sub, "reject")}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              ) : (
                modalJobSubmissions.filter(sub => sub.status === 'approved').length === 0 ? (
                  <div className="empty-placeholder">
                    No approved submissions for this job.
                  </div>
                ) : (
                  <div className="pending-submissions-list">
                    {modalJobSubmissions
                      .filter(sub => sub.status === 'approved')
                      .map((sub) => {
                        return (
                          <div key={sub.id} className="submission-item-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="submission-user-info">
                                <span className="submission-user-name" style={{ fontSize: '1rem', fontWeight: 600 }}>{sub.userName}</span>
                                <span className="submission-user-email" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub.userEmail}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                <span className="submission-submitted-at" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Submitted: {new Date(sub.submittedAt.toDate()).toLocaleString()}
                                </span>
                                <span className="status-capsule active" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--success)', color: '#fff', width: 'fit-content' }}>
                                  Approved (+{sub.xpAwarded} XP)
                                </span>
                              </div>
                            </div>

                            <div className="submission-content-box" style={{ width: '100%' }}>
                              {renderSubmissionContent(sub.content)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {isJobCalendarPopupOpen && jobStep === 2 && createPortal(
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1090,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(2px)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsJobCalendarPopupOpen(false);
            }}
          />
          <div
            className="calendar-popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 1100 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!selectedJobCalendarDate ? (
                <>
                  {/* Month selector header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', minWidth: '28px', fontSize: '0.75rem' }}
                      onClick={handlePrevMonth}
                    >
                      &larr;
                    </button>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {getMonthName(currentCalendarMonth)} {currentCalendarYear}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', minWidth: '28px', fontSize: '0.75rem' }}
                      onClick={handleNextMonth}
                    >
                      &rarr;
                    </button>
                  </div>
                  
                  {/* Days of week and days grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', padding: '0.35rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', padding: '0.1rem 0' }}>
                        {d}
                      </div>
                    ))}
                    {(() => {
                      const daysInMonth = getDaysInMonth(currentCalendarMonth, currentCalendarYear);
                      const firstDayIndex = getFirstDayOfMonth(currentCalendarMonth, currentCalendarYear);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      const cells: React.ReactNode[] = [];

                      // Empty cells for days before the first of the month
                      for (let i = 0; i < firstDayIndex; i++) {
                        cells.push(<div key={`empty-${i}`} style={{ width: '100%', aspectRatio: '1', padding: '0.25rem' }}></div>);
                      }

                      // Days in the month
                      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                        const cellDate = new Date(currentCalendarYear, currentCalendarMonth, dayNum);
                        const isSelected = selectedJobCalendarDate && 
                          (selectedJobCalendarDate as any).getDate() === dayNum && 
                          (selectedJobCalendarDate as any).getMonth() === currentCalendarMonth && 
                          (selectedJobCalendarDate as any).getFullYear() === currentCalendarYear;
                        
                        const isToday = today.getDate() === dayNum && 
                          today.getMonth() === currentCalendarMonth && 
                          today.getFullYear() === currentCalendarYear;

                        const isPast = cellDate < today;

                        cells.push(
                          <button
                            key={`day-${dayNum}`}
                            type="button"
                            disabled={isPast}
                            onClick={() => {
                              setSelectedJobCalendarDate(cellDate);
                              updateJobDeadlineFromCalendar(cellDate, jobCalendarHour, jobCalendarMinute);
                            }}
                            style={{
                              width: '100%',
                              aspectRatio: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              fontWeight: isSelected ? '700' : '500',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: isPast ? 'not-allowed' : 'pointer',
                              backgroundColor: isSelected 
                                ? 'var(--primary)' 
                                : isToday 
                                  ? 'var(--bg-surface-hover)' 
                                  : 'transparent',
                              color: isSelected 
                                ? '#fff' 
                                : isPast 
                                  ? 'var(--text-muted)' 
                                  : 'var(--text-primary)',
                              transition: 'all var(--transition-fast)',
                              outline: 'none',
                            }}
                          >
                            {dayNum}
                          </button>
                        );
                      }

                      return cells;
                    })()}
                  </div>
                </>
              ) : (
                /* Selected date / time details */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Date: <strong style={{ color: 'var(--text-primary)' }}>{selectedJobCalendarDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                    </div>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600', padding: 0 }}
                      onClick={() => {
                        setSelectedJobCalendarDate(null);
                      }}
                    >
                      Change Date
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.25rem 0' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>Time (24h):</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      className="form-control"
                      style={{ padding: '0.25rem', width: '55px', textAlign: 'center', fontSize: '0.75rem', height: '30px' }}
                      value={jobCalendarHour}
                      onChange={(e) => {
                        let val = e.target.value;
                        setJobCalendarHour(val);
                        updateJobDeadlineFromCalendar(selectedJobCalendarDate, val, jobCalendarMinute);
                      }}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) val = 0;
                        if (val > 23) val = 23;
                        const formatted = String(val).padStart(2, '0');
                        setJobCalendarHour(formatted);
                        updateJobDeadlineFromCalendar(selectedJobCalendarDate, formatted, jobCalendarMinute);
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.75rem' }}>:</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      className="form-control"
                      style={{ padding: '0.25rem', width: '55px', textAlign: 'center', fontSize: '0.75rem', height: '30px' }}
                      value={jobCalendarMinute}
                      onChange={(e) => {
                        let val = e.target.value;
                        setJobCalendarMinute(val);
                        updateJobDeadlineFromCalendar(selectedJobCalendarDate, jobCalendarHour, val);
                      }}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) val = 0;
                        if (val > 59) val = 59;
                        const formatted = String(val).padStart(2, '0');
                        setJobCalendarMinute(formatted);
                        updateJobDeadlineFromCalendar(selectedJobCalendarDate, jobCalendarHour, formatted);
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginTop: '0.25rem', height: '28px', fontSize: '0.75rem', padding: '0' }}
                    onClick={() => setIsJobCalendarPopupOpen(false)}
                  >
                    Confirm & Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* User Creation Modal */}
      {isUserModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUserModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingUser ? "Edit User Account" : "Register New User"}</div>
              <button type="button" className="modal-close-btn" onClick={() => setIsUserModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-name">Full Name</label>
                  <input
                    id="user-name"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Alice Smith"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-username">Username</label>
                  <input
                    id="user-username"
                    type="text"
                    className="form-control"
                    placeholder="e.g. alice_smith"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-email">Email Address</label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-control"
                    placeholder="e.g. alice@sydions.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    className="form-control"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as "user" | "admin")}
                    required
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsUserModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={userCreating}>
                    {userCreating ? (editingUser ? "Saving..." : "Creating...") : (editingUser ? "Save Changes" : "Add User Account")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Task Submissions Modal */}
      {isSubmissionsModalOpen && selectedTaskForSubmissions && (
        <div className="modal-overlay" onClick={() => { setIsSubmissionsModalOpen(false); setModalTab("pending"); }}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div className="modal-title">Submissions: {selectedTaskForSubmissions.title}</div>
              <button type="button" className="modal-close-btn" onClick={() => { setIsSubmissionsModalOpen(false); setModalTab("pending"); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '1rem', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', marginTop: '1rem' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: modalTab === "pending" ? '2px solid var(--primary)' : '2px solid transparent',
                  color: modalTab === "pending" ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '0.5rem 0.25rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
                onClick={() => setModalTab("pending")}
              >
                Pending Approvals ({modalSubmissions.filter(s => s.status === 'pending').length})
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: modalTab === "approved" ? '2px solid var(--primary)' : '2px solid transparent',
                  color: modalTab === "approved" ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '0.5rem 0.25rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
                onClick={() => setModalTab("approved")}
              >
                Approved & Rated ({modalSubmissions.filter(s => s.status === 'approved').length})
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1.5rem' }}>
              {modalSubmissionsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                </div>
              ) : modalTab === "pending" ? (
                modalSubmissions.filter(sub => sub.status === 'pending').length === 0 ? (
                  <div className="empty-placeholder">
                    No pending submissions for this task.
                  </div>
                ) : (
                  <div className="pending-submissions-list">
                    {modalSubmissions
                      .filter(sub => sub.status === 'pending')
                      .sort((a, b) => new Date(a.submittedAt.toDate()).getTime() - new Date(b.submittedAt.toDate()).getTime())
                      .map((sub, index) => {
                        const isGradingDisabled = index > 0;
                        return (
                          <div key={sub.id} className="submission-item-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: isGradingDisabled ? 0.7 : 1 }}>
                            <div className="submission-meta" style={{ flexGrow: 1, flexDirection: 'column', gap: '0.5rem', marginRight: '2rem' }}>
                              <div className="submission-user-info">
                                <span className="submission-user-name" style={{ fontSize: '1.05rem' }}>{sub.userName}</span>
                                <span className="submission-user-email">{sub.userEmail}</span>
                              </div>
                              <span className="submission-submitted-at" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Submitted: {new Date(sub.submittedAt.toDate()).toLocaleString()}
                              </span>
                              <div className="submission-content-box" style={{ marginTop: '0.5rem', width: '100%', maxWidth: '800px' }}>{renderSubmissionContent(sub.content)}</div>
                            </div>
                            <div className="submission-actions-row" style={{ flexShrink: 0, gap: '0.75rem', display: 'flex', flexDirection: 'column', minWidth: '110px' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ backgroundColor: isGradingDisabled ? 'var(--text-muted)' : "var(--success)", width: '100%', cursor: isGradingDisabled ? 'not-allowed' : 'pointer' }}
                                disabled={isGradingDisabled}
                                title={isGradingDisabled ? "Please grade older submissions first" : ""}
                                onClick={() => handleSubmissionAction(sub, "approve")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ borderColor: isGradingDisabled ? 'var(--border-color)' : "var(--danger)", color: isGradingDisabled ? 'var(--text-muted)' : "var(--danger)", width: '100%', cursor: isGradingDisabled ? 'not-allowed' : 'pointer' }}
                                disabled={isGradingDisabled}
                                title={isGradingDisabled ? "Please grade older submissions first" : ""}
                                onClick={() => handleSubmissionAction(sub, "reject")}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              ) : (
                modalSubmissions.filter(sub => sub.status === 'approved').length === 0 ? (
                  <div className="empty-placeholder">
                    No approved submissions for this task.
                  </div>
                ) : (
                  <div className="pending-submissions-list">
                    {modalSubmissions
                      .filter(sub => sub.status === 'approved')
                      .map((sub) => {
                        const ratingsForSub = modalRatings.filter(r => r.submission_id === sub.id);
                        const avgRating = ratingsForSub.length > 0
                          ? (ratingsForSub.reduce((acc, curr) => acc + curr.rating, 0) / ratingsForSub.length).toFixed(1)
                          : null;

                        return (
                          <div key={sub.id} className="submission-item-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="submission-user-info">
                                <span className="submission-user-name" style={{ fontSize: '1rem', fontWeight: 600 }}>{sub.userName}</span>
                                <span className="submission-user-email" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub.userEmail}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                <span className="submission-submitted-at" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Submitted: {new Date(sub.submittedAt.toDate()).toLocaleString()}
                                </span>
                                {avgRating ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(251,191,36,0.1)', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.2)' }}>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '0.8rem' }}>★ {avgRating}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({ratingsForSub.length})</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No ratings yet</span>
                                )}
                              </div>
                            </div>

                            <div className="submission-content-box" style={{ width: '100%' }}>
                              {renderSubmissionContent(sub.content)}
                            </div>

                            {ratingsForSub.length > 0 && (
                              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Peer Ratings Breakdown (Admin Only):</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {ratingsForSub.map((rating) => {
                                    const rater = usersList.find(u => u.uid === rating.rater_id);
                                    return (
                                      <span key={rating.id} style={{ fontSize: '0.7rem', background: 'var(--bg-surface-hover)', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                                        @{rater?.username || 'unknown'}: <strong>{rating.rating} ★</strong>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspend User Modal */}
      {isSuspendModalOpen && userToSuspend && (
        <div className="modal-overlay" onClick={() => { setIsSuspendModalOpen(false); setUserToSuspend(null); }}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Suspend @{userToSuspend.username}</div>
              <button type="button" className="modal-close-btn" onClick={() => { setIsSuspendModalOpen(false); setUserToSuspend(null); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleConfirmSuspend}>
                <div className="form-group">
                  <label className="form-label">Suspension Type</label>
                  <div className="toggle-btn-group" style={{ marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      className={`toggle-option ${suspendType === "day" ? "active" : ""}`}
                      onClick={() => {
                        setSuspendType("day");
                      }}
                    >
                      Day Wise
                    </button>
                    <button
                      type="button"
                      className={`toggle-option ${suspendType === "hour" ? "active" : ""}`}
                      onClick={() => {
                        setSuspendType("hour");
                        setSuspendDays("0");
                      }}
                    >
                      Hour Wise
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {suspendType === "day" && (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Days</span>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          placeholder="0"
                          value={suspendDays}
                          onChange={(e) => setSuspendDays(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hours</span>
                      <input
                        type="number"
                        min="0"
                        max={suspendType === "hour" ? 23 : undefined}
                        className="form-control"
                        placeholder="0"
                        value={suspendHours}
                        onChange={(e) => setSuspendHours(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Minutes</span>
                      <input
                        type="number"
                        min="0"
                        max={59}
                        className="form-control"
                        placeholder="0"
                        value={suspendMinutes}
                        onChange={(e) => setSuspendMinutes(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {suspendType === "hour" && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                      * Hour-wise suspension is limited to a single day (max 23 hours, 59 minutes).
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setIsSuspendModalOpen(false); setUserToSuspend(null); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}>
                    Confirm Suspension
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isCalendarPopupOpen && taskStep === 2 && createPortal(
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1090,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(2px)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsCalendarPopupOpen(false);
            }}
          />
          <div
            className="calendar-popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 1100 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!selectedCalendarDate ? (
                <>
                  {/* Month selector header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', minWidth: '28px', fontSize: '0.75rem' }}
                      onClick={handlePrevMonth}
                    >
                      &larr;
                    </button>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {getMonthName(currentCalendarMonth)} {currentCalendarYear}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', minWidth: '28px', fontSize: '0.75rem' }}
                      onClick={handleNextMonth}
                    >
                      &rarr;
                    </button>
                  </div>
                  
                  {/* Days of week and days grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', padding: '0.35rem', background: 'var(--bg-base)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', padding: '0.1rem 0' }}>
                        {d}
                      </div>
                    ))}
                    {renderCalendarDays()}
                  </div>
                </>
              ) : (
                /* Selected date / time details */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Date: <strong style={{ color: 'var(--text-primary)' }}>{selectedCalendarDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                    </div>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600', padding: 0 }}
                      onClick={() => {
                        setSelectedCalendarDate(null);
                      }}
                    >
                      Change Date
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.25rem 0' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>Time (24h):</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      className="form-control"
                      style={{ padding: '0.25rem', width: '55px', textAlign: 'center', fontSize: '0.75rem', height: '30px' }}
                      value={calendarHour}
                      onChange={(e) => {
                        let val = e.target.value;
                        setCalendarHour(val);
                        updateDeadlineFromCalendar(selectedCalendarDate, val, calendarMinute);
                      }}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) val = 0;
                        if (val > 23) val = 23;
                        const formatted = String(val).padStart(2, '0');
                        setCalendarHour(formatted);
                        updateDeadlineFromCalendar(selectedCalendarDate, formatted, calendarMinute);
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.75rem' }}>:</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      className="form-control"
                      style={{ padding: '0.25rem', width: '55px', textAlign: 'center', fontSize: '0.75rem', height: '30px' }}
                      value={calendarMinute}
                      onChange={(e) => {
                        let val = e.target.value;
                        setCalendarMinute(val);
                        updateDeadlineFromCalendar(selectedCalendarDate, calendarHour, val);
                      }}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) val = 0;
                        if (val > 59) val = 59;
                        const formatted = String(val).padStart(2, '0');
                        setCalendarMinute(formatted);
                        updateDeadlineFromCalendar(selectedCalendarDate, calendarHour, formatted);
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginTop: '0.25rem', height: '28px', fontSize: '0.75rem', padding: '0' }}
                    onClick={() => setIsCalendarPopupOpen(false)}
                  >
                    Confirm & Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Quest Creation/Edit Stepper Modal */}
      {isQuestModalOpen && (
        <div className="modal-overlay" onClick={() => setIsQuestModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingQuest ? "Edit Quest" : "Create Quest"}</div>
              <button type="button" className="modal-close-btn" onClick={() => setIsQuestModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Stepper Header */}
            <div className="stepper-container" style={{ marginTop: '1.5rem' }}>
              <div className="stepper-line-bg"></div>
              <div className="stepper-line-active" style={{ width: `${((questStep - 1) / 2) * 100}%` }}></div>
              <div className={`stepper-step ${questStep === 1 ? "active" : ""} ${questStep > 1 ? "completed" : ""}`}>
                <div className="stepper-circle">1</div>
                <div className="stepper-label">Details</div>
              </div>
              <div className={`stepper-step ${questStep === 2 ? "active" : ""} ${questStep > 2 ? "completed" : ""}`}>
                <div className="stepper-circle">2</div>
                <div className="stepper-label">Requirements</div>
              </div>
              <div className={`stepper-step ${questStep === 3 ? "active" : ""}`}>
                <div className="stepper-circle">3</div>
                <div className="stepper-label">Builder</div>
              </div>
            </div>

            <div className="modal-body" style={{ paddingTop: '0.5rem' }}>
              <form onSubmit={handleCreateQuest}>
                {questStep === 1 && (
                  <div className="stepper-content-body" style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Quest Title</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Master SQL & Database Optimization"
                        value={questTitle}
                        onChange={(e) => setQuestTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description & Instructions</label>
                      <textarea
                        className="form-control"
                        placeholder="Describe what users need to do in this quest..."
                        rows={4}
                        value={questDescription}
                        onChange={(e) => setQuestDescription(e.target.value)}
                        required
                        style={{ resize: 'none' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select
                        className="form-control"
                        value={questCategory}
                        onChange={(e: any) => setQuestCategory(e.target.value)}
                      >
                        <option value="weekly">Weekly Quest</option>
                        <option value="monthly">Monthly Quest</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Start Date & Time</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={questStartTime}
                          onChange={(e) => setQuestStartTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">End Date & Time</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={questEndTime}
                          onChange={(e) => setQuestEndTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {questStep === 2 && (
                  <div className="stepper-content-body" style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label">Minimum EXP Required</label>
                      <input
                        type="number"
                        className="form-control"
                        value={questMinExp}
                        onChange={(e) => setQuestMinExp(e.target.value)}
                        min={0}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                        Users must have at least this much Task Balance (EXP) to unlock and join the quest.
                      </span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Minimum XP Required</label>
                      <input
                        type="number"
                        className="form-control"
                        value={questMinXp}
                        onChange={(e) => setQuestMinXp(e.target.value)}
                        min={0}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                        Users must have at least this much Leveling points (XP) to unlock and join the quest.
                      </span>
                    </div>
                  </div>
                )}

                {questStep === 3 && (
                  <div className="stepper-content-body" style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1rem', background: 'var(--bg-surface-hover)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Add Quest Question / Task</div>
                      
                      <QuestQuestionBuilderForm
                        onAdd={(newQ) => {
                          setQuestQuestions(prev => [...prev, newQ]);
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Quest Question List ({questQuestions.length})</div>
                      {questQuestions.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No questions added. Add at least one above.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {questQuestions.map((q, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                <span style={{ color: 'var(--primary-hover)', fontWeight: 600, marginRight: '0.25rem' }}>[{q.type.toUpperCase()}]</span>
                                {q.question}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--accent-gold)' }}>+{q.xp_reward} XP</span>
                                <span style={{ color: 'var(--primary-hover)' }}>+{q.exp_reward} EXP</span>
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                                  onClick={() => setQuestQuestions(prev => prev.filter((_, i) => i !== idx))}
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (questStep > 1) {
                        setQuestStep(prev => prev - 1);
                      } else {
                        setIsQuestModalOpen(false);
                      }
                    }}
                  >
                    {questStep === 1 ? "Cancel" : "Back"}
                  </button>
                  
                  {questStep < 3 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setQuestStep(prev => prev + 1)}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={questCreating || questQuestions.length === 0}
                    >
                      {questCreating ? "Saving..." : editingQuest ? "Save Changes" : "Create Quest"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Quest Grading Modal */}
      {isQuestGradingModalOpen && selectedQuestForGrading && (
        <div className="modal-overlay" onClick={() => setIsQuestGradingModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div className="modal-title">Grade Quest: {selectedQuestForGrading.title}</div>
              <button type="button" className="modal-close-btn" onClick={() => setIsQuestGradingModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
              {questGradingLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading participants...</div>
              ) : questGradingParticipants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No participants have joined or submitted this quest yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {questGradingParticipants.map((part) => {
                    const user = part.users || {};
                    const isSubmitted = part.status === "submitted";
                    const isGraded = part.status === "completed" || part.status === "failed";
                    const questQuestionsList = selectedQuestForGrading.quest_data || [];
                    const userAnswers = part.submission?.answers || [];

                    return (
                      <div key={part.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1rem', background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                          <div>
                            <strong>{user.name || "Unknown User"}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>@{user.username || "unknown"}</span>
                          </div>
                          <span className={`status-capsule ${part.status === 'submitted' ? 'pending' : part.status === 'completed' ? 'active' : 'expired'}`} style={{ textTransform: 'capitalize' }}>
                            {part.status}
                          </span>
                        </div>

                        {/* Display answers */}
                        {isSubmitted || isGraded ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                            {questQuestionsList.map((q: any, idx: number) => {
                              const ans = userAnswers[idx];
                              return (
                                <div key={idx} style={{ fontSize: '0.8rem', background: 'var(--bg-base)', padding: '0.5rem', borderRadius: '4px' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Q{idx + 1}: {q.question}</div>
                                  <div style={{ marginTop: '0.25rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                    <strong>Submitted Answer:</strong> {ans !== undefined ? String(ans) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
                                  </div>
                                  {q.type === "mcq" && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      Correct Answer: {q.answer}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            User joined but has not submitted the quest yet.
                          </div>
                        )}

                        {isSubmitted && (
                          <QuestParticipantGradingAction
                            maxScore={questQuestionsList.length * 10}
                            defaultXp={questQuestionsList.reduce((acc: number, q: any) => acc + (q.xp_reward || 0), 0)}
                            defaultExp={questQuestionsList.reduce((acc: number, q: any) => acc + (q.exp_reward || 0), 0)}
                            onGrade={(score, xp, exp, success) => {
                              handleGradeQuestParticipant(part.id, part.user_id, score, xp, exp, success ? "completed" : "failed");
                            }}
                          />
                        )}

                        {isGraded && (
                          <div style={{ fontSize: '0.75rem', background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                            <span>Score: {part.score}</span>
                            <span>Rewarded: {part.xp_earned} XP / {part.exp_earned} EXP</span>
                            <span>Reviewed on: {new Date(part.reviewed_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
