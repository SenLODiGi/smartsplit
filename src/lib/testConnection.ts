import { supabase, isSupabaseConfigured } from "./supabase";

export interface SupabaseConnectionResult {
  success: boolean;
  situation:
    | "connection_successful"
    | "missing_environment_variables"
    | "invalid_api_key"
    | "invalid_project_url"
    | "network_or_cors_problem"
    | "other_error";
  message: string;
  urlHost?: string;
  details?: string;
}

/**
 * Safely verifies connection to Supabase using non-destructive requests.
 * Does not require an authenticated user.
 * Does not require existing database tables.
 * Does not insert, update, or delete records.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionResult> {
  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
    "";

  const envKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
    "";

  // Situation 1: Missing environment variables
  if (
    !envUrl ||
    !envKey ||
    envUrl === "YOUR_EXISTING_PROJECT_URL" ||
    envKey === "YOUR_EXISTING_PUBLISHABLE_KEY"
  ) {
    return {
      success: false,
      situation: "missing_environment_variables",
      message:
        "Missing environment variables. Please check your .env.local file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }

  // Situation 2: Invalid project URL format
  let urlHost = "";
  try {
    const parsed = new URL(envUrl);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("Protocol must be http or https");
    }
    urlHost = parsed.hostname;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      situation: "invalid_project_url",
      message: `Invalid project URL: ${msg}`,
      details: msg,
    };
  }

  try {
    // 1. Preferred approach: Check client auth session initialization
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      const msg = sessionError.message.toLowerCase();
      if (msg.includes("api key") || msg.includes("jwt") || msg.includes("unauthorized")) {
        return {
          success: false,
          situation: "invalid_api_key",
          message: "Supabase rejected the public publishable key.",
          urlHost,
          details: sessionError.message,
        };
      }
    }

    // 2. Network verification probe (safe, read-only head probe that requires zero tables)
    // PostgREST inspects the 'apikey' and validates credentials before table resolution
    const { error: probeError } = await supabase
      .from("_connection_test_probe_")
      .select("*", { count: "exact", head: true });

    if (probeError) {
      const errorMessage = probeError.message || "";
      const errorCode = probeError.code || "";

      // PostgREST 401 or Invalid API Key / JWT error
      if (
        errorCode === "PGRST301" ||
        errorMessage.toLowerCase().includes("api key") ||
        errorMessage.toLowerCase().includes("jwt") ||
        errorMessage.toLowerCase().includes("unauthorized")
      ) {
        return {
          success: false,
          situation: "invalid_api_key",
          message: "Supabase rejected the public publishable key. Verify VITE_SUPABASE_ANON_KEY.",
          urlHost,
          details: errorMessage,
        };
      }

      // Relation not found (PGRST205 or 42P01) means:
      // The API key was VALID and ACCEPTED by Supabase PostgREST, and it reached the database layer!
      if (
        errorCode === "PGRST205" ||
        errorCode === "42P01" ||
        errorMessage.toLowerCase().includes("does not exist") ||
        errorMessage.toLowerCase().includes("relation")
      ) {
        return {
          success: true,
          situation: "connection_successful",
          message:
            "Connection verified! Supabase accepted the project URL and public key. (Ready for schema migration).",
          urlHost,
          details: "API key and project URL verified by Supabase API.",
        };
      }

      // RLS policy permission error also confirms valid auth & connection
      if (
        errorCode === "42501" ||
        errorMessage.toLowerCase().includes("permission denied") ||
        errorMessage.toLowerCase().includes("row-level security")
      ) {
        return {
          success: true,
          situation: "connection_successful",
          message: "Connection verified! Supabase accepted credentials (RLS active).",
          urlHost,
        };
      }
    }

    // Zero errors or valid response
    return {
      success: true,
      situation: "connection_successful",
      message: "Connection successfully verified with Supabase project.",
      urlHost,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();

    // Situation: Network or CORS problem
    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("cors") ||
      lower.includes("enotfound") ||
      lower.includes("econnrefused") ||
      lower.includes("getaddrinfo")
    ) {
      return {
        success: false,
        situation: "network_or_cors_problem",
        message:
          "Network or CORS problem while connecting to Supabase. Check internet connectivity and project URL status.",
        urlHost,
        details: message,
      };
    }

    // Situation: Other errors
    return {
      success: false,
      situation: "other_error",
      message: `An unexpected error occurred during connection test: ${message}`,
      urlHost,
      details: message,
    };
  }
}
