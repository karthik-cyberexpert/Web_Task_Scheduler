# Supabase SMTP Email Setup Guide (Dashboard-Only)

This guide explains how to connect your Gmail SMTP server to Supabase and deploy the email-sending mechanism using the **Supabase Dashboard** (bypassing the need for the Supabase CLI on your local machine).

---

## Method: GitHub Integration & Edge Functions

This is the recommended method for using Gmail SMTP. You push your code (which contains our Edge Function) to GitHub, and Supabase deploys it automatically.

### Step 1: Push your Code to GitHub
1. Ensure the new Edge Function folder `supabase/functions/send-email/` (containing `index.js`) is added to your local repository.
2. Commit your changes and push them to your GitHub repository:
   ```bash
   git add .
   git commit -m "Add Supabase email Edge Function"
   git push origin main
   ```

### Step 2: Link GitHub in the Supabase Dashboard
1. Go to the [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. In the left navigation bar, click on **Project Settings** (the gear icon).
3. Scroll down or select **Integrations** from the menu.
4. Locate the **GitHub** integration section and click **Connect**.
5. Authorize Supabase to access your GitHub account.
6. Select your project repository and the branch (e.g., `main`) you want to deploy from.
7. Save. Supabase will automatically build and deploy the `send-email` Edge Function.

### Step 3: Configure SMTP Secrets in the Dashboard
Since we are not using the CLI to set secrets, configure them directly in the dashboard:
1. In your project settings, click on **Edge Functions** in the sidebar.
2. Select the **send-email** function from the list.
3. Click on the **Settings** or **Secrets** tab.
4. Add the following environment variables (secrets):
   - **Key:** `SMTP_USER` | **Value:** Your Gmail address (e.g., `yourname@gmail.com`)
   - **Key:** `SMTP_PASS` | **Value:** Your 16-character Google App Password (without spaces)
   - **Key:** `SMTP_HOST` | **Value:** `smtp.gmail.com`
   - **Key:** `SMTP_PORT` | **Value:** `465`
   - **Key:** `SMTP_FROM` | **Value:** `Sydions Portal <yourname@gmail.com>`
5. Save the secrets.

### Step 4: Create the Database Webhook
To trigger the function whenever a new email is queued in the database:
1. In the Supabase Dashboard, click on **Database** in the left navigation sidebar.
2. Select **Webhooks** from the database menu.
3. Click **Create Webhook** and fill in the details:
   - **Name:** `send_email_trigger`
   - **Table:** `public.mail` (Schema: `public`)
   - **Events:** Select `INSERT` only (uncheck UPDATE/DELETE)
   - **Type:** `Supabase Edge Functions`
   - **Method:** `POST`
   - **Function:** Select `send-email`
   - **Timeout:** `5000` ms
4. Click **Save** to enable the webhook.

---

## Verification

Once configured, any greeting or task notification sent by the application will insert a record into the `mail` table. The Database Webhook will trigger the Edge Function, which will send the email via Gmail SMTP and update the status from `pending` to `sent` or `failed` in the database.
