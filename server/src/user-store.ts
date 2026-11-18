import { readFileSync } from "node:fs"
import type { User } from "./users.ts"

function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false
  const user = value as Record<string, unknown>
  return (
    typeof user.id === "string" &&
    user.id !== "" &&
    typeof user.username === "string" &&
    user.username !== "" &&
    (user.role === "admin" || user.role === "user") &&
    typeof user.salt === "string" && /^[a-f0-9]{32}$/.test(user.salt) &&
    typeof user.passwordHash === "string" && /^[a-f0-9]{128}$/.test(user.passwordHash)
  )
}

export function loadUsers(file: string): User[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed) || !parsed.every(isUser) ||
    new Set(parsed.map((u) => u.id)).size !== parsed.length ||
    new Set(parsed.map((u) => u.username)).size !== parsed.length) {
    throw new Error(`Invalid user file: ${file}`)
  }
  return parsed
}
