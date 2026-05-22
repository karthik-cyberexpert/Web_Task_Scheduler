import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import admin from "https://esm.sh/firebase-admin@11.11.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Request headers
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { uid } = await req.json()
    if (!uid) {
      return new Response(JSON.stringify({ error: 'Missing uid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Initialize Firebase Admin
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable in Supabase')
    }

    const serviceAccount = JSON.parse(serviceAccountJson)
    
    // Avoid double initialization
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })
    }

    // 3. Delete user from Firebase Auth
    await admin.auth().deleteUser(uid)

    return new Response(JSON.stringify({ success: true, message: `Successfully deleted user ${uid} from Firebase Auth` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("Delete user error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
