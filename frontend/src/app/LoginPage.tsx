import { useState, type FormEvent } from "react"
import { Images, LogIn } from "lucide-react"
import "../styles/LoginPage.css"
import { login } from "./api.ts"
import type { User } from "./api.ts"

type LoginPageProps = {
  onLogin: (user: User) => void
  authenticate?: (username: string, password: string) => Promise<User>
}

export function LoginPage({ onLogin, authenticate = login }: LoginPageProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      onLogin(await authenticate(username, password))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-showcase">
          <div className="login-logo-placeholder" aria-label="Logo placeholder">
            <Images size={34} aria-hidden="true" />
          </div>
          <div>
            <p className="login-product-label">Photo management, simplified</p>
            <h1>Smart Photo Album</h1>
            <p className="login-product-copy">
              Keep every event memory organized, accessible, and ready to share.
            </p>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-panel-content">
            <p className="login-eyebrow">Account access</p>
            <h2 id="login-title">Welcome back</h2>
            <p className="login-intro">Enter your details to continue to your photo library.</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                name="username"
                autoComplete="username"
                maxLength={200}
                disabled={submitting}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />

              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={1024}
                disabled={submitting}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              {error && <p className="login-error" role="alert">{error}</p>}

              <button type="submit" disabled={submitting}>
                <LogIn size={17} aria-hidden="true" />
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
