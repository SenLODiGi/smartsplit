import { createClient } from "@supabase/supabase-js";

// Read Supabase environment variables from Vite (import.meta.env) with process.env fallback
const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
  "";

const supabaseKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
  "";

// Determine if valid production Supabase credentials are configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    supabaseUrl !== "YOUR_EXISTING_PROJECT_URL" &&
    supabaseKey !== "YOUR_EXISTING_PUBLISHABLE_KEY" &&
    (supabaseUrl.startsWith("http://") || supabaseUrl.startsWith("https://"))
);

if (!isSupabaseConfigured) {
  console.warn(
    "[SmartSplit] Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not set. " +
      "The app will operate in demo/fallback mode. " +
      "To connect to live Supabase on Vercel, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY under Project Settings -> Environment Variables."
  );
}

// Create a singleton Supabase client. If credentials are not yet configured in Vercel,
// a safe dummy client is provided with session persistence disabled to prevent network crashes.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder-project.supabase.co",
  isSupabaseConfigured ? supabaseKey : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder",
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  }
);
