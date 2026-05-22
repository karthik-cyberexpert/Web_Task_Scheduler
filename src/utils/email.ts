import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { supabase } from "../supabaseClient";

export interface MailPayload {
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export const sendMail = async (payload: MailPayload): Promise<{ success: boolean; message: string }> => {
  let firebaseSuccess = false;
  let supabaseSuccess = false;
  const errorMessages: string[] = [];

  // 1. Try sending via Firebase Trigger Email extension (writes to 'mail' collection)
  try {
    if (db) {
      const timeoutMs = 5000;
      await Promise.race([
        addDoc(collection(db, "mail"), {
          to: payload.toEmail,
          message: {
            subject: payload.subject,
            text: payload.textBody,
            html: payload.htmlBody || payload.textBody.replace(/\n/g, "<br>"),
          },
          created_at: new Date().toISOString(),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firebase Firestore write timed out")), timeoutMs)
        ),
      ]);
      firebaseSuccess = true;
    }
  } catch (err: any) {
    console.error("Firebase mail trigger write failed:", err);
    errorMessages.push(`Firebase: ${err.message || err}`);
  }

  // 2. Try sending via Supabase Database Email Queue (writes to public.mail table)
  try {
    const { error } = await supabase.from("mail").insert({
      to_email: payload.toEmail,
      subject: payload.subject,
      text_body: payload.textBody,
      html_body: payload.htmlBody || payload.textBody.replace(/\n/g, "<br>"),
    });
    if (error) {
      throw error;
    }
    supabaseSuccess = true;
  } catch (err: any) {
    console.error("Supabase mail queue insert failed:", err);
    errorMessages.push(`Supabase: ${err.message || err}`);
  }

  if (firebaseSuccess || supabaseSuccess) {
    return {
      success: true,
      message: `Email queued successfully (Firebase: ${firebaseSuccess ? "Ok" : "Failed"}, Supabase: ${supabaseSuccess ? "Ok" : "Failed"})`,
    };
  }

  return {
    success: false,
    message: `All email triggers failed: ${errorMessages.join(" | ")}`,
  };
};

export interface SendEmailParams {
  toEmail: string;
  toName: string;
  username: string;
  password?: string;
}

export const sendGreetingEmail = async (params: SendEmailParams): Promise<{ success: boolean; message: string }> => {
  const defaultPassword = params.password || "user@sydions";
  const loginUrl = window.location.origin;

  const onboardingSteps = `
Hello ${params.toName},

Welcome to Sydions Portal! Your user account has been registered by the administration.

Here are your account credentials:
- Username: @${params.username}
- Email: ${params.toEmail}
- Default Password: ${defaultPassword}

Next Steps:
1. Access the Sydions Portal at: ${loginUrl}
2. Log in using either your email address or your username.
3. Upon your first login, complete the onboarding profile setup.
4. View your assigned tasks, submit solutions, earn EXP rewards, and track your ranking on the platform leaderboard.
  `.trim();

  return sendMail({
    toEmail: params.toEmail,
    subject: "Welcome to Sydions Portal!",
    textBody: onboardingSteps,
  });
};

export interface SendTaskAssignmentParams {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline: string;
}

export const sendTaskAssignmentEmail = async (params: SendTaskAssignmentParams): Promise<{ success: boolean; message: string }> => {
  const textBody = `
Hello ${params.toName},

You have been assigned a new task on the Sydions Portal.

- Task Title: ${params.taskTitle}
- Deadline: ${params.taskDeadline}

Please log in to your dashboard to view the instructions and submit your solution.
  `.trim();

  return sendMail({
    toEmail: params.toEmail,
    subject: `New Task Assigned: ${params.taskTitle}`,
    textBody: textBody,
  });
};

export interface SendDeadlineReminderParams {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline: string;
  reminderType: "before_day" | "on_day";
}

export const sendDeadlineReminder = async (params: SendDeadlineReminderParams): Promise<{ success: boolean; message: string }> => {
  const reminderMessage = params.reminderType === "before_day"
    ? `This is a reminder that the deadline for your assigned task is tomorrow.`
    : `URGENT: This is a reminder that the deadline for your assigned task is today.`;

  const textBody = `
Hello ${params.toName},

${reminderMessage}

- Task Title: ${params.taskTitle}
- Deadline: ${params.taskDeadline}

If you have not already done so, please log in to your dashboard, complete the deliverables, and submit your solution for approval.
  `.trim();

  const urgencyPrefix = params.reminderType === "on_day" ? "URGENT REMINDER" : "REMINDER";

  return sendMail({
    toEmail: params.toEmail,
    subject: `[${urgencyPrefix}] Task Deadline Alert: ${params.taskTitle}`,
    textBody: textBody,
  });
};
