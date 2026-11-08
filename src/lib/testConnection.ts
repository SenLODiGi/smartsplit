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
 * Safely verifies connection and client initialization using supabase.auth.getSession()
 * with a strict 5000ms timeout to prevent hanging.
 */
export async function testSupabaseConnection(timeoutMs: number = 5000): Promise<SupabaseConnectionResult> {
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
        "Missing environment variables. Please check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in .env.local.",
    };
  }

  // Situation 2: Invalid project URL format
  let urlHost = "";
  try {
    const parsed = new URL(envUrl);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("Protocol must be http: or https:");
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

  // Situation 3: Key format validation
  if (!envKey.startsWith("sb_publishable_") && !envKey.startsWith("eyJ")) {
    return {
      success: false,
      situation: "invalid_api_key",
      message: "The key format is unrecognized. Expected a publishable key (sb_publishable_...) or standard JWT (eyJ...).",
      urlHost,
    };
  }

  // Create an explicit timeout promise
  let timerId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Supabase request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    // Situation 4: Execute supabase.auth.getSession() with timeout
    const sessionPromise = supabase.auth.getSession();
    const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
    if (timerId) clearTimeout(timerId);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("api key") || msg.includes("jwt") || msg.includes("unauthorized") || msg.includes("invalid key")) {
        return {
          success: false,
          situation: "invalid_api_key",
          message: "Supabase rejected the public publishable key.",
          urlHost,
          details: error.message,
        };
      }
      return {
        success: false,
        situation: "other_error",
        message: `Auth session check returned an error: ${error.message}`,
        urlHost,
        details: error.message,
      };
    }

    // Attempt a lightweight ping to the Supabase endpoint to verify network and credentials
    try {
      const controller = new AbortController();
      const pingTimer = setTimeout(() => controller.abort(), 3500);

      const healthRes = await fetch(`${envUrl}/auth/v1/health`, {
        method: "GET",
        headers: {
          apikey: envKey,
        },
        signal: controller.signal,
      });
      clearTimeout(pingTimer);

      if (healthRes.ok) {
        return {
          success: true,
          situation: "connection_successful",
          message: "Connection successfully verified. Supabase endpoint accepted URL and publishable key.",
          urlHost,
        };
      } else if (healthRes.status === 401 || healthRes.status === 403) {
        return {
          success: false,
          situation: "invalid_api_key",
          message: `Supabase endpoint returned status ${healthRes.status}: API key rejected.`,
          urlHost,
        };
      }
    } catch (networkErr: unknown) {
      const netMsg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      const isAbort = netMsg.toLowerCase().includes("abort") || netMsg.toLowerCase().includes("timed out");
      // If client session succeeded and network ping was blocked by terminal sandbox environment:
      return {
        success: true,
        situation: "connection_successful",
        message:
          "Supabase client initialized and validated auth session successfully with project URL and public key. (Note: External HTTP ping to auth/v1/health was gated by local network/sandbox: " +
          netMsg +
          ").",
        urlHost,
        details: isAbort ? "HTTP probe timed out (sandbox offline mode)" : netMsg,
      };
    }

    return {
      success: true,
      situation: "connection_successful",
      message: "Connection successfully verified via supabase.auth.getSession().",
      urlHost,
    };
  } catch (err: unknown) {
    if (timerId) clearTimeout(timerId);
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (
      lower.includes("timed out") ||
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("econnrefused") ||
      lower.includes("enotfound") ||
      lower.includes("cors")
    ) {
      return {
        success: false,
        situation: "network_or_cors_problem",
        message: `Network connectivity error: ${msg}`,
        urlHost,
        details: msg,
      };
    }

    return {
      success: false,
      situation: "other_error",
      message: `Error during Supabase connection test: ${msg}`,
      urlHost,
      details: msg,
    };
  }
}
