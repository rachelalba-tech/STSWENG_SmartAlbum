import { expect, test } from "vitest"
import { resolvePhotoUrl } from "../src/app/api.ts"

test("resolves uploaded image paths against the API host but leaves external photo URLs unchanged", () => {
  const apiUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, "")
  expect(resolvePhotoUrl("/api/uploads/photo.jpg")).toBe(`${apiUrl}/api/uploads/photo.jpg`)
  expect(resolvePhotoUrl("https://images.example.test/photo.jpg")).toBe("https://images.example.test/photo.jpg")
  expect(resolvePhotoUrl("/images/photo.jpg")).toBe("/images/photo.jpg")
})
