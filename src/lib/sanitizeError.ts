/**
 * Maps raw backend/Supabase errors to user-friendly messages.
 * Prevents leaking database schema, table names, and internal details.
 */
export function sanitizeError(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : (error as any)?.message ?? "";
  const code = typeof error === "object" && error !== null ? (error as any)?.code ?? "" : "";
  const weakPasswordReasons =
    typeof error === "object" && error !== null && Array.isArray((error as any)?.weak_password?.reasons)
      ? (error as any).weak_password.reasons
      : [];

  if (!message) return "An unexpected error occurred. Please try again.";

  // Auth-related
  if (message.includes("Invalid login credentials")) return "Invalid email or password.";
  if (message.includes("Email not confirmed")) return "Please verify your email before signing in.";
  if (message.includes("User already registered")) return "An account with this email already exists.";
  if (message.includes("Password should be at least")) return "Password is too short. Use at least 6 characters.";
  if (code === "weak_password" || message.toLowerCase().includes("weak password")) {
    if (weakPasswordReasons.includes("pwned") || message.toLowerCase().includes("easy to guess")) {
      return "This password has appeared in known data breaches or is too easy to guess. Please choose a stronger, unique password.";
    }
    return "Please choose a stronger password.";
  }
  if (message.includes("rate limit") || message.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";

  // Storage
  if (message.includes("Payload too large") || message.includes("too large"))
    return "File is too large. Please choose a smaller file.";
  if (message.includes("mime type") || message.includes("content type"))
    return "This file type is not supported.";

  // RLS / permissions
  if (message.includes("row-level security") || message.includes("permission denied"))
    return "You don't have permission to perform this action.";

  // Duplicate / conflict
  if (message.includes("duplicate key") || message.includes("already exists"))
    return "This item already exists.";

  // Not found
  if (message.includes("not found") || message.includes("does not exist"))
    return "The requested item was not found.";

  // Network
  if (message.includes("Failed to fetch") || message.includes("NetworkError"))
    return "Network error. Please check your connection and try again.";

  // Generic fallback — don't expose raw message
  return "Something went wrong. Please try again.";
}
