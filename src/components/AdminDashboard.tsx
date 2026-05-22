import React, { useState, useEffect } from "react";
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

// Helpers to map Supabase snake_case rows to the camelCase formats with mock Firebase timestamps (.toDate())
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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onShowToast, currentUser, onBackToUser }) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "users" | "leaderboard">("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [taskStep, setTaskStep] = useState(1);

  // Submissions modal states
  const [selectedTaskForSubmissions, setSelectedTaskForSubmissions] = useState<any>(null);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);

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
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskAssignedType, setTaskAssignedType] = useState<"all" | "specific">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [maxXP, setMaxXP] = useState("500");
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
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);

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
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions from Supabase:", error);
      return;
    }
    if (data) {
      const mapped = data.map(mapSubmission);
      setPendingSubmissions(mapped);
      setPendingSubmissionsCount(mapped.length);
    }
  };

  // Real-time listeners
  useEffect(() => {
    fetchUsers();
    fetchTasks();
    fetchSubmissions();

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

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(submissionsChannel);
    };
  }, []);

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
      if (editingTask) {
        const { error: updateErr } = await supabase
          .from("tasks")
          .update({
            title: taskTitle.trim(),
            description: taskDescription.trim(),
            deadline: new Date(taskDeadline).toISOString(),
            max_xp: xpVal,
            assigned_type: taskAssignedType,
            assigned_users: taskAssignedType === "all" ? [] : selectedUserIds,
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
          assigned_type: taskAssignedType,
          assigned_users: taskAssignedType === "all" ? [] : selectedUserIds,
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

          if (taskAssignedType === "all") {
            const { data: usersData } = await supabase
              .from("users")
              .select("email, name")
              .neq("role", "admin");
            if (usersData) {
              usersToNotify = usersData;
            }
          } else {
            const { data: usersData } = await supabase
              .from("users")
              .select("email, name")
              .in("uid", selectedUserIds);
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

        // 2. Update submission in Supabase
        const { error: subErr } = await supabase
          .from("submissions")
          .update({
            status: "approved",
            xp_awarded: xpAwarded,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", submission.id);

        if (subErr) throw new Error(subErr.message);

        // 3. Update user's aggregate XP in Supabase
        if (xpAwarded > 0) {
          const { data: userData, error: fetchErr } = await supabase
            .from("users")
            .select("xp")
            .eq("uid", submission.userId)
            .maybeSingle();

          if (fetchErr) throw new Error(fetchErr.message);

          const currentXp = userData?.xp || 0;
          const { error: userErr } = await supabase
            .from("users")
            .update({ xp: currentXp + xpAwarded })
            .eq("uid", submission.userId);

          if (userErr) throw new Error(userErr.message);
        }

        onShowToast(`Submission approved! Awarded ${xpAwarded} EXP to ${submission.userName}.`, "success");
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




  // Sort usersList to construct Leaderboard on Overview
  const leaderboardList = [...usersList].sort((a, b) => b.xp - a.xp);

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
          <div className="brand-badge">Admin Panel</div>
        </div>
        <div className="nav-user-info">
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
              ) : (
                <div className="user-table-wrapper">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Deadline</th>
                        <th>Reward</th>
                        <th>Assignment</th>
                        <th>Status</th>
                        <th>Submissions</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksList.map((task) => {
                        const isOverdue = new Date(task.deadline.toDate()) < new Date();
                        const taskPendingCount = pendingSubmissions.filter((sub) => sub.taskId === task.id).length;
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
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={taskPendingCount === 0}
                                onClick={() => {
                                  setSelectedTaskForSubmissions(task);
                                  setIsSubmissionsModalOpen(true);
                                }}
                              >
                                View Pending ({taskPendingCount})
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
                </div>
              )}
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
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>EXP Balance</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                          No registered users found. Click "New User" to add one.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((user) => (
                        <tr key={user.uid}>
                          <td><strong>{user.name}</strong></td>
                          <td>@{user.username}</td>
                          <td>{user.email}</td>
                          <td>
                            <span className="brand-badge" style={{ fontSize: "0.6rem", padding: "0.15rem 0.35rem" }}>
                              {user.role}
                            </span>
                          </td>
                          <td style={{ color: "var(--primary-hover)", fontWeight: "700" }}>{user.xp} EXP</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="action-icon-btn edit-btn"
                                title="Edit User"
                                onClick={() => handleEditUserClick(user)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn reset-btn"
                                title="Reset Password"
                                onClick={() => handleResetPassword(user.uid, user.username)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn delete-btn"
                                title="Delete User"
                                onClick={() => handleDeleteUser(user.uid, user.email)}
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
                      ))
                    )}
                  </tbody>
                </table>
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
                  usersList.sort((a, b) => b.xp - a.xp).map((user, idx) => {
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
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--primary-hover)' }}>{user.xp} EXP</td>
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

          {isCalendarPopupOpen && taskStep === 2 && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1090,
                  background: 'transparent',
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
            </>
          )}
        </div>
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
        <div className="modal-overlay" onClick={() => setIsSubmissionsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Submissions: {selectedTaskForSubmissions.title}</div>
              <button type="button" className="modal-close-btn" onClick={() => setIsSubmissionsModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {pendingSubmissions.filter(sub => sub.taskId === selectedTaskForSubmissions.id).length === 0 ? (
                <div className="empty-placeholder">
                  No pending submissions for this task.
                </div>
              ) : (
                <div className="pending-submissions-list">
                  {pendingSubmissions
                    .filter(sub => sub.taskId === selectedTaskForSubmissions.id)
                    .map((sub) => (
                      <div key={sub.id} className="submission-item-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            className="btn btn-primary btn-sm"
                            style={{ backgroundColor: "var(--success)", width: '100%' }}
                            onClick={() => handleSubmissionAction(sub, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ borderColor: "var(--danger)", color: "var(--danger)", width: '100%' }}
                            onClick={() => handleSubmissionAction(sub, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
