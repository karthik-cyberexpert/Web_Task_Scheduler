import { supabase } from "../supabaseClient";

export interface MailPayload {
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export const sendMail = async (payload: MailPayload): Promise<{ success: boolean; message: string }> => {
  try {
    const { error } = await supabase
      .from("mail")
      .insert({
        to_email: payload.toEmail,
        subject: payload.subject,
        text_body: payload.textBody,
        html_body: payload.htmlBody || payload.textBody,
        status: "pending",
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: "Email queued in Supabase successfully.",
    };
  } catch (error: any) {
    console.error("Error queueing email in Supabase:", error);
    return {
      success: false,
      message: error.message || "Failed to queue email.",
    };
  }
};

export interface SendEmailParams {
  toEmail: string;
  toName: string;
  username: string;
  password?: string;
}

export const sendGreetingEmail = async (params: SendEmailParams): Promise<{ success: boolean; message: string }> => {
  const subject = "Welcome to Sydions Portal!";
  const textBody = `Hello ${params.toName},\n\nYour account has been registered by the admin.\n\nUsername: ${params.username}\nPassword: ${params.password || "user@sydions"}\n\nLog in here: ${window.location.origin}`;
  const htmlBody = `
    <h3>Welcome to Sydions Portal, ${params.toName}!</h3>
    <p>Your account has been registered by the admin.</p>
    <p><strong>Username:</strong> ${params.username}</p>
    <p><strong>Password:</strong> ${params.password || "user@sydions"}</p>
    <p><a href="${window.location.origin}">Log in to your workspace</a></p>
  `;
  return sendMail({ toEmail: params.toEmail, subject, textBody, htmlBody });
};

export interface SendTaskAssignmentParams {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline: string;
}

export const sendTaskAssignmentEmail = async (params: SendTaskAssignmentParams): Promise<{ success: boolean; message: string }> => {
  const subject = `New Task Assigned: ${params.taskTitle}`;
  const textBody = `Hello ${params.toName},\n\nYou have been assigned a new task: "${params.taskTitle}".\n\nDeadline: ${params.taskDeadline}\n\nPlease check your workspace dashboard for details.`;
  const htmlBody = `
    <h3>New Task Assigned</h3>
    <p>Hello ${params.toName},</p>
    <p>You have been assigned a new task: <strong>"${params.taskTitle}"</strong>.</p>
    <p><strong>Deadline:</strong> ${params.taskDeadline}</p>
    <p><a href="${window.location.origin}">Open your dashboard to view the details</a></p>
  `;
  return sendMail({ toEmail: params.toEmail, subject, textBody, htmlBody });
};

export interface SendDeadlineReminderParams {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline: string;
  reminderType: "before_day" | "on_day";
}

export const sendDeadlineReminder = async (params: SendDeadlineReminderParams): Promise<{ success: boolean; message: string }> => {
  const urgencyText = params.reminderType === "on_day" ? "is due today!" : "is due tomorrow!";
  const subject = `Reminder: Task "${params.taskTitle}" ${urgencyText}`;
  const textBody = `Hello ${params.toName},\n\nThis is a reminder that the task "${params.taskTitle}" is approaching its deadline.\n\nDeadline: ${params.taskDeadline}\n\nPlease submit your solution before the deadline.`;
  const htmlBody = `
    <h3>Task Deadline Reminder</h3>
    <p>Hello ${params.toName},</p>
    <p>This is a reminder that the task <strong>"${params.taskTitle}"</strong> is approaching its deadline.</p>
    <p><strong>Deadline:</strong> ${params.taskDeadline} (${params.reminderType === "on_day" ? "Due Today" : "Due Tomorrow"})</p>
    <p><a href="${window.location.origin}">Open your dashboard to submit your solution</a></p>
  `;
  return sendMail({ toEmail: params.toEmail, subject, textBody, htmlBody });
};
