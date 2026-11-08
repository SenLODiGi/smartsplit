import { supabase, isSupabaseConfigured } from "./supabase";

export interface SupabaseConnectionResult {
  success: boolean;
  status:
    | "connected"
    | "connected_table_pending"
    | "invalid_credentials"
    | "network_error"
    | "unconfigured"
    | "error";
  message: string;
  details?: string;
  urlHost?: string;
}

/**
 * Safely tests connection to Supabase without modifying or inserting records.
 * Distinguishes between network errors, credential errors, and schema/table prerequisites.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionResult> {
  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
    "";

  // 1. Check whether configuration is present
  if (!isSupabaseConfigured) {
    return {
      success: false,
      status: "unconfigured",
      message:
        "Supabase credentials are not configured. Please set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values in .env.local.",
    };
  }

  let urlHost = "";
  try {
    urlHost = new URL(envUrl).hostname;
  } catch {
    urlHost = "invalid-url";
  }

  try {
    // 2. Perform safe, read-only head probe against profiles table
    // head: true retrieves zero rows (metadata/status check only)
    const { data: _data, error, count: _count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (!error) {
      return {
        success: true,
        status: "connected",
        message: "Successfully connected to Supabase database. Authentication and tables verified.",
        urlHost,
      };
    }

    const errorMessage = error.message || "";
    const errorCode = error.code || "";

    // 3. Inspect PostgREST response details
    // Check if the error is due to missing tables (schema not yet migrated)
    if (
      errorCode === "PGRST205" ||
      errorCode === "42P01" ||
      errorMessage.toLowerCase().includes("does not exist") ||
      errorMessage.toLowerCase().includes("relation")
    ) {
      return {
        success: true,
        status: "connected_table_pending",
        message:
          "Successfully reached Supabase and verified API credentials! The 'profiles' table is not yet created in the database. Run the database migration script in Supabase SQL Editor.",
        urlHost,
        details: `Table pending: ${errorMessage}`,
      };
    }

    // Check if RLS policy blocked the head request (still indicates successful auth & connection)
    if (
      errorCode === "42501" ||
      errorMessage.toLowerCase().includes("permission denied") ||
      errorMessage.toLowerCase().includes("row-level security")
    ) {
      return {
        success: true,
        status: "connected",
        message:
          "Successfully reached Supabase with valid credentials. (Row-level security policy active).",
        urlHost,
      };
    }

    // Check if API key or authorization token is invalid
    if (
      errorCode === "PGRST301" ||
      errorMessage.toLowerCase().includes("jwt") ||
      errorMessage.toLowerCase().includes("api key") ||
      errorMessage.toLowerCase().includes("unauthorized")
    ) {
      return {
        success: false,
        status: "invalid_credentials",
        message:
          "Supabase project reached, but the API key was rejected. Verify VITE_SUPABASE_ANON_KEY in .env.local.",
        urlHost,
        details: errorMessage,
      };
    }

    // Other PostgREST error, but connection reached the server
    return {
      success: true,
      status: "connected",
      message: `Reached Supabase server (${urlHost}). Response: ${errorMessage}`,
      urlHost,
      details: errorMessage,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Network / DNS resolution errors
    if (
      message.toLowerCase().includes("failed to fetch") ||
      message.toLowerCase().includes("networkerror") ||
      message.toLowerCase().includes("enotfound") ||
      message.toLowerCase().includes("getaddrinfo")
    ) {
      return {
        success: false,
        status: "network_error",
        message:
          "Could not reach Supabase. Check your internet connection and verify VITE_SUPABASE_URL in .env.local.",
        urlHost,
        details: message,
      };
    }

    return {
      success: false,
      status: "error",
      message: `Connection test encountered an error: ${message}`,
      urlHost,
      details: message,
    };
  }
}
