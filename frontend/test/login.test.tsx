import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import App from "../src/app/App.tsx"
import { LoginPage } from "../src/app/LoginPage.tsx"

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ""
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith("/api/session") ? { error: "sign in required" } : []), { status: url.endsWith("/api/session") ? 401 : 200 })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test("login is shown after the server rejects a forged localStorage session", async () => {
  window.localStorage.setItem("smart-album-user", JSON.stringify({ id: "demo-user", username: "forged", role: "admin" }))
  render(<App />)

  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy()
  expect(screen.getByRole("heading", { name: "Smart Photo Album" })).toBeTruthy()
  expect(screen.getByLabelText("Logo placeholder")).toBeTruthy()
  expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull()
})

test("submits credentials and opens the application", async () => {
  const authenticate = vi.fn(async () => ({ id: "demo-user", username: "test", role: "admin" as const }))
  const onLogin = vi.fn()
  render(<LoginPage onLogin={onLogin} authenticate={authenticate} />)

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "test" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "tester123" } })
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: "demo-user", username: "test", role: "admin" }))
  expect(authenticate).toHaveBeenCalledWith("test", "tester123")
})

test("restores the server session, keeps the app on logout failure, then revokes it", async () => {
  let failLogout = true
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/api/session")) return new Response(JSON.stringify({ id: "demo-user", username: "test", role: "admin" }))
    if (url.endsWith("/api/logout")) return new Response(null, { status: failLogout ? 500 : 204 })
    return new Response("[]")
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<App />)
  fireEvent.click(await screen.findByRole("button", { name: "Log out" }))
  expect((await screen.findByRole("alert")).textContent).toContain("Could not log out")
  expect(screen.queryByRole("heading", { name: "Welcome back" })).toBeNull()
  failLogout = false
  fireEvent.click(screen.getByRole("button", { name: "Log out" }))
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy()
  for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) expect(init.credentials).toBe("include")
})

test("an expired API session returns to login and clears private views", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.endsWith("/api/session") ? JSON.stringify({ id: "u", username: "test", role: "user" }) : "[]")))
  render(<App />)
  await screen.findByRole("button", { name: "Log out" })
  await screen.findByRole("heading", { name: "Photo albums" })
  expect(screen.queryByRole("button", { name: "New album" })).toBeNull()
  act(() => window.dispatchEvent(new Event("session-expired")))
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy()
  expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull()
})

test("session connection failures require a retry, not a trusted local session", async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Response("{}", { status: 401 }))
  vi.stubGlobal("fetch", request)
  render(<App />)
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }))
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy()
})

test("shows an error when credentials are rejected", async () => {
  const authenticate = vi.fn(async () => {
    throw new Error("Incorrect username or password")
  })
  render(<LoginPage onLogin={vi.fn()} authenticate={authenticate} />)

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "test" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } })
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

  expect((await screen.findByRole("alert")).textContent).toBe("Incorrect username or password")
})
