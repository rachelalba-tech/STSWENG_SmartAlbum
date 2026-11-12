import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, test, vi } from "vitest"
import App from "../src/app/App.tsx"
import { LoginPage } from "../src/app/LoginPage.tsx"

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ""
})

test("login is the first screen for a signed-out user", () => {
  render(<App />)

  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy()
  expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull()
})

test("submits credentials and opens the application", async () => {
  const authenticate = vi.fn(async () => ({ id: "demo-user", username: "test" }))
  const onLogin = vi.fn()
  render(<LoginPage onLogin={onLogin} authenticate={authenticate} />)

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "test" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "tester123" } })
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: "demo-user", username: "test" }))
  expect(authenticate).toHaveBeenCalledWith("test", "tester123")
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
