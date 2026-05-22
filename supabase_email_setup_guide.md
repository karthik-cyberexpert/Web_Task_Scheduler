# Supabase SMTP & Email Setup Guide (Dashboard-Only)

This guide explains how to configure email sending entirely through the **Supabase Dashboard** without using the Supabase CLI or GitHub Integration.

> [!NOTE]
> **Supabase Auth Custom SMTP Settings vs. Custom Application Emails**
> The Custom SMTP settings configured in the Supabase Dashboard (under Project Settings > Auth) are strictly used by Supabase's authentication service (GoTrue) for registration, password recovery, and login emails.
> 
> Because PostgreSQL cannot directly access those encrypted settings or execute SMTP network protocols, we cannot use those built-in settings directly from a database trigger. Instead, you can reuse the same Gmail address and App Password via a free Make.com/Zapier webhook (described in Option B below) to send all task and greeting emails.

Since standard SMTP protocols cannot be executed directly from a database trigger without a server, we use a database webhook to connect to an external email service.


---

## Option A: Direct Webhook to Resend API (Recommended)

This method uses a free **Resend** account (3,000 free emails per month) and a Postgres trigger that calls Resend's HTTP API directly from your database.

### Step 1: Get a Resend API Key
1. Sign up for a free account at [Resend](https://resend.com/).
2. Go to **API Keys** in the Resend dashboard and create a key. Copy it.

### Step 2: Enable the `pg_net` extension in Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. In the left menu, go to **Database** > **Extensions**.
3. Search for **pg_net** (HTTP client for PostgreSQL) and toggle it **ON** if not already enabled.

### Step 3: Run the Email Trigger SQL Script
1. In your Supabase Dashboard, click on **SQL Editor** in the left menu.
2. Click **New Query**.
3. Paste the following SQL script (replace `YOUR_RESEND_API_KEY` with your copied key and update the sender email address):

```sql
-- Create a function to send the email via Resend's API
CREATE OR REPLACE FUNCTION public.send_email_via_resend()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_RESEND_API_KEY'
    ),
    body := jsonb_build_object(
      'from', 'Sydions Portal <onboarding@resend.dev>',
      'to', jsonb_build_array(new.to_email),
      'subject', new.subject,
      'html', coalesce(new.html_body, new.text_body)
    )
  );
  
  -- Update status to sent in the background
  UPDATE public.mail SET status = 'sent' WHERE id = new.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger that fires on insert into public.mail
DROP TRIGGER IF EXISTS tr_send_email ON public.mail;
CREATE TRIGGER tr_send_email
  AFTER INSERT ON public.mail
  FOR EACH ROW
  EXECUTE FUNCTION public.send_email_via_resend();
```

4. Click **Run**.

---

## Option B: Webhook to Make.com / Zapier (For Gmail SMTP)

If you must use your Gmail SMTP account, you can create a free account on an automation platform (like Make or Zapier) to forward the database webhook payload to Gmail.

### Step 1: Create a Webhook Scenario on Make.com
1. Sign up for a free account on [Make.com](https://www.make.com/).
2. Create a new Scenario.
3. Add a **Custom Webhook** module. Copy the webhook URL.
4. Add a **Gmail** (or Email) module:
   - Action: **Send an Email**.
   - Connect your Google Account.
   - Map the fields from the webhook payload:
     - **To:** `record.to_email`
     - **Subject:** `record.subject`
     - **Content:** `record.html_body` (or `record.text_body`)
5. Turn the scenario ON.

### Step 2: Create a Webhook in Supabase
1. In the Supabase Dashboard, click on **Database** > **Webhooks**.
2. Click **Create Webhook**:
   - **Name:** `send_gmail_webhook`
   - **Table:** `public.mail`
   - **Events:** `INSERT`
   - **Type:** `HTTP Webhook`
   - **Method:** `POST`
   - **URL:** Paste the Make.com Webhook URL.
3. Click **Save** to enable the webhook.
