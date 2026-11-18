import { scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

export type User = {
  id: string
  username: string
  role: "admin" | "user"
  salt: string
  passwordHash: string
}
export type PublicUser = Pick<User, "id" | "username" | "role">
const deriveKey = promisify(scrypt)

export async function authenticateUser(users: User[], username: string, password: string): Promise<PublicUser | undefined> {
  const user = users.find((candidate) => candidate.username === username)
  // Unknown usernames do the same expensive work, without disclosing account existence.
  const key = await deriveKey(password, user?.salt ?? "00000000000000000000000000000000", 64) as Buffer
  const expected = Buffer.from(user?.passwordHash ?? "0".repeat(128), "hex")
  if (!timingSafeEqual(key, expected) || !user) return undefined
  return { id: user.id, username: user.username, role: user.role }
}
