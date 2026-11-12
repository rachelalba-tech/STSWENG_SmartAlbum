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
    typeof user.password === "string" &&
    user.password !== ""
  )
}

export function loadUsers(file: string): User[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed) || !parsed.every(isUser)) {
    throw new Error(`Invalid user file: ${file}`)
  }
  return parsed
}
