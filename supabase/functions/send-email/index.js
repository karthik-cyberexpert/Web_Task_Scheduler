import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/smtp@v1.2.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("Received webhook payload:", JSON.stringify(payload))

    // Webhook event info
    const { record } = payload
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'No record found in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { id, to_email, subject, text_body, html_body } = record

    // Get SMTP credentials from Supabase secrets
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPortStr = Deno.env.get('SMTP_PORT') || '465'
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    const smtpFrom = Deno.env.get('SMTP_FROM') || smtpUser

    if (!smtpUser || !smtpPass) {
      throw new Error('SMTP credentials (SMTP_USER/SMTP_PASS) are not set in Supabase environment')
    }

    const smtpPort = parseInt(smtpPortStr, 10)
    const isSecure = smtpPort === 465

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: isSecure,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    console.log(`Sending email to ${to_email} via SMTP...`)
    await client.send({
      from: smtpFrom,
      to: to_email,
      subject: subject,
      content: text_body,
      html: html_body || text_body,
    })
    console.log("Email sent successfully!")

    // Initialize Supabase Client to update the status
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { error: updateErr } = await supabase
        .from('mail')
        .update({ status: 'sent' })
        .eq('id', id)
      
      if (updateErr) {
        console.error("Failed to update status in database:", updateErr)
      } else {
        console.log(`Updated mail record ${id} status to 'sent'`)
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Email sent and record updated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("SMTP function error:", error)
    
    // Attempt to mark as failed in db
    try {
      const payload = await req.json().catch(() => ({}))
      const recordId = payload.record?.id
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (recordId && supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('mail')
          .update({ status: 'failed' })
          .eq('id', recordId)
      }
    } catch (dbErr) {
      console.error("Failed to mark as failed in DB:", dbErr)
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
