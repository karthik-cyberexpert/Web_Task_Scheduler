export interface SendEmailParams {
  toEmail: string;
  toName: string;
  username: string;
  password?: string;
}

export const sendGreetingEmail = async (params: SendEmailParams): Promise<{ success: boolean; message: string }> => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn("EmailJS environment variables (VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY) are not configured. Email notification skipped.");
    return {
      success: false,
      message: "EmailJS environment variables not configured. Email greeting skipped.",
    };
  }

  const defaultPassword = params.password || "user@sydions";
  const loginUrl = window.location.origin;

  const onboardingSteps = `
1. Access the Sydions Portal at: ${loginUrl}
2. Log in using either your email (${params.toEmail}) or your username (@${params.username}).
3. Enter your default password: ${defaultPassword}
4. Upon your first login, you will be guided through our onboarding wizard to set up your profile details.
5. Once onboarded, view your assigned tasks, submit solutions, earn EXP rewards, and track your ranking on the platform leaderboard.
  `.trim();

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_name: params.toName,
          to_email: params.toEmail,
          username: params.username,
          password: defaultPassword,
          login_url: loginUrl,
          onboarding_steps: onboardingSteps,
        },
      }),
    });

    if (response.ok) {
      return { success: true, message: "Greeting email sent successfully." };
    } else {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error ${response.status}`);
    }
  } catch (error: any) {
    console.error("Failed to send greeting email via EmailJS:", error);
    return {
      success: false,
      message: error.message || "Failed to send email via EmailJS service API.",
    };
  }
};
