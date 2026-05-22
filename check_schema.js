import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let supabaseUrl = "";
let supabaseAnonKey = "";

if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("VITE_SUPABASE_URL=")) {
      supabaseUrl = line.split("=")[1].trim();
    }
    if (line.startsWith("VITE_SUPABASE_ANON_KEY=")) {
      supabaseAnonKey = line.split("=")[1].trim();
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`
      }
    });
    const schema = await res.json();
    console.log("Raw Response:", schema);
  } catch (err) {
    console.error("Error fetching schema:", err);
  }
}

run();

