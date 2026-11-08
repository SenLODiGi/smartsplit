import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
  "";

const supabaseKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
  "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase environment variables are missing. Check your .env.local file."
  );
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    supabaseUrl !== "YOUR_EXISTING_PROJECT_URL" &&
    supabaseKey !== "YOUR_EXISTING_PUBLISHABLE_KEY" &&
    (supabaseUrl.startsWith("http://") || supabaseUrl.startsWith("https://"))
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder-project.supabase.co",
  isSupabaseConfigured ? supabaseKey : "placeholder-key"
);
