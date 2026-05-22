export interface MailPayload {
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export const sendMail = async (_payload: MailPayload): Promise<{ success: boolean; message: string }> => {
  return {
    success: true,
    message: "Email notifications are disabled.",
  };
};

export interface SendEmailParams {
  toEmail: string;
  toName: string;
  username: string;
  password?: string;
}

export const sendGreetingEmail = async (_params: SendEmailParams): Promise<{ success: boolean; message: string }> => {
  return {
    success: true,
    message: "Email notifications are disabled.",
  };
};

export interface SendTaskAssignmentParams {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline: string;
}

export const sendTaskAssignmentEmail = async (_params: SendTaskAssignmentParams): Promise<{ success: boolean; message: string }> => {
  return {
    success: true,
    message: "Email notifications are disabled.",
  };
};

export interface SendDeadlineReminderParams {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline: string;
  reminderType: "before_day" | "on_day";
}

export const sendDeadlineReminder = async (_params: SendDeadlineReminderParams): Promise<{ success: boolean; message: string }> => {
  return {
    success: true,
    message: "Email notifications are disabled.",
  };
};
