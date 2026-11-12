export type User = {
  id: string
  username: string
  password: string
}

export type PublicUser = Omit<User, "password">

export function authenticateUser(
  users: User[],
  username: string,
  password: string,
): PublicUser | undefined {
  const user = users.find((candidate) => candidate.username === username && candidate.password === password)
  if (!user) return undefined
  return { id: user.id, username: user.username }
}
