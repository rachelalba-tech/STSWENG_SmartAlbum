// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { Photo } from "../src/app/api.ts"
import { AppTabs } from "../src/app/AppTabs.tsx"
import { PhotoUpload } from "../src/app/PhotoUpload.tsx"
import { pageFromHash } from "../src/app/route.ts"

// jsdom has no object URLs, which the previews rely on.
beforeAll(() => {
  URL.createObjectURL = () => "blob:preview"
  URL.revokeObjectURL = () => {}
})

afterEach(cleanup)

const albums = [
  { id: "a", name: "Opening ceremony" },
  { id: "b", name: "Reception" },
]

const file = (name: string, type = "image/png", size = 10) =>
  new File([new Uint8Array(size)], name, { type, lastModified: 1 })

const photoFor = (albumId: string, f: File): Photo => ({
  id: `id-${f.name}`,
  src: `/api/uploads/${f.name}`,
  thumbnail: `/api/uploads/${f.name}`,
  title: f.name,
  description: "",
  date: "2024-01-01",
  albumId,
  tags: [],
})

const fakeUpload = () => vi.fn(async (albumId: string, f: File) => photoFor(albumId, f))

const choose = (files: File[]) =>
  fireEvent.change(screen.getByLabelText("Choose photos"), { target: { files } })

const uploadButton = () => screen.getByRole("button", { name: /^Upload \d+ photos?$|^Uploading/ })

// The page

test("shows the upload page with a drop zone", () => {
  render(<PhotoUpload albums={albums} />)
  expect(screen.getByText("Upload Photos")).toBeTruthy()
  expect(screen.getByText("Add new photos to your collection")).toBeTruthy()
  expect(screen.getByText("Drop photos here")).toBeTruthy()
  expect(screen.getByText("or click to select files from your device")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Select Photos" })).toBeTruthy()
  expect(screen.getByText("Supports: JPG, PNG, GIF, WebP")).toBeTruthy()
})

test("no upload button until photos are selected", () => {
  render(<PhotoUpload albums={albums} />)
  expect(screen.queryByRole("button", { name: /^Upload \d+/ })).toBeNull()
})

test("Select Photos opens the file picker", () => {
  render(<PhotoUpload albums={albums} />)
  const input = screen.getByLabelText("Choose photos") as HTMLInputElement
  const click = vi.spyOn(input, "click")
  fireEvent.click(screen.getByRole("button", { name: "Select Photos" }))
  expect(click).toHaveBeenCalledTimes(1)
})

// Selecting

test("selected photos are listed and ready to upload", () => {
  render(<PhotoUpload albums={albums} />)
  choose([file("one.png"), file("two.jpg", "image/jpeg")])
  expect(screen.getByText("one.png")).toBeTruthy()
  expect(screen.getByText("two.jpg")).toBeTruthy()
  expect(screen.getAllByText("Ready")).toHaveLength(2)
  expect(uploadButton().textContent).toBe("Upload 2 photos")
})

test("choosing more photos adds to the list instead of replacing it", () => {
  render(<PhotoUpload albums={albums} />)
  choose([file("one.png")])
  choose([file("two.png")])
  expect(screen.getByText("one.png")).toBeTruthy()
  expect(screen.getByText("two.png")).toBeTruthy()
})

test("dropping photos on the zone adds them", () => {
  const { container } = render(<PhotoUpload albums={albums} />)
  fireEvent.drop(container.querySelector(".pu-drop")!, { dataTransfer: { files: [file("dropped.webp", "image/webp")] } })
  expect(screen.getByText("dropped.webp")).toBeTruthy()
})

test("files that are not supported images are skipped with a message, not silently dropped", () => {
  render(<PhotoUpload albums={albums} />)
  choose([file("ok.png"), file("notes.txt", "text/plain"), file("logo.svg", "image/svg+xml")])
  expect(screen.getByText("ok.png")).toBeTruthy()
  expect(screen.queryByText("notes.txt", { selector: ".pu-item-name" })).toBeNull()
  const notice = screen.getByRole("status").textContent!
  expect(notice).toContain("notes.txt")
  expect(notice).toContain("logo.svg")
})

test("photos over 10 MB are skipped with a message", () => {
  render(<PhotoUpload albums={albums} />)
  choose([file("huge.png", "image/png", 10 * 1024 * 1024 + 1)])
  expect(screen.queryByText("huge.png", { selector: ".pu-item-name" })).toBeNull()
  expect(screen.getByRole("status").textContent).toContain("huge.png is larger than 10 MB")
})

test("selecting the same photo twice lists it once and says so", () => {
  render(<PhotoUpload albums={albums} />)
  choose([file("one.png")])
  choose([file("one.png")])
  expect(screen.getAllByText("one.png", { selector: ".pu-item-name" })).toHaveLength(1)
  expect(screen.getByRole("status").textContent).toContain("already selected")
})

test("a selected photo can be removed", () => {
  render(<PhotoUpload albums={albums} />)
  choose([file("one.png"), file("two.png")])
  fireEvent.click(screen.getByRole("button", { name: "Remove one.png" }))
  expect(screen.queryByText("one.png")).toBeNull()
  expect(screen.getByText("two.png")).toBeTruthy()
})

// Uploading

test("uploading sends every photo to the chosen album and reports all of them", async () => {
  const upload = fakeUpload()
  const onUploaded = vi.fn()
  render(<PhotoUpload albums={albums} upload={upload} onUploaded={onUploaded} />)
  fireEvent.change(screen.getByLabelText("Upload to album"), { target: { value: "b" } })
  choose([file("1.png"), file("2.png"), file("3.png"), file("4.png"), file("5.png")])
  fireEvent.click(uploadButton())

  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Uploaded 5 photos."))
  expect(upload).toHaveBeenCalledTimes(5)
  expect(upload.mock.calls.every(([albumId]) => albumId === "b")).toBe(true)
  expect(onUploaded).toHaveBeenCalledTimes(1)
  expect(onUploaded.mock.calls[0][0].map((p: Photo) => p.title).sort()).toEqual(["1.png", "2.png", "3.png", "4.png", "5.png"])
  expect(screen.getAllByText("Uploaded", { selector: ".pu-item-status" })).toHaveLength(5)
})

test("uploads to the photo library without an album by default", async () => {
  const upload = fakeUpload()
  render(<PhotoUpload albums={albums} upload={upload} />)
  choose([file("1.png")])
  fireEvent.click(uploadButton())
  await waitFor(() => expect(upload).toHaveBeenCalledWith("", expect.any(File)))
})

test("allows uploading photos when there are no albums", async () => {
  const upload = fakeUpload()
  const onUploaded = vi.fn()
  render(<PhotoUpload albums={[]} upload={upload} onUploaded={onUploaded} />)
  choose([file("solo.png")])
  fireEvent.click(uploadButton())
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Uploaded 1 photo."))
  expect(upload).toHaveBeenCalledWith("", expect.any(File))
  expect(onUploaded).toHaveBeenCalledTimes(1)
  expect(onUploaded.mock.calls[0][0][0].albumId).toBe("")
})

test("a failed photo stays listed, the rest are saved, and retry sends only the failed one", async () => {
  let failOnce = true
  const upload = vi.fn(async (albumId: string, f: File) => {
    if (f.name === "bad.png" && failOnce) {
      failOnce = false
      throw new Error("Upload failed (500)")
    }
    return photoFor(albumId, f)
  })
  const onUploaded = vi.fn()
  render(<PhotoUpload albums={albums} upload={upload} onUploaded={onUploaded} />)
  choose([file("good.png"), file("bad.png")])
  fireEvent.click(uploadButton())

  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Uploaded 1 of 2"))
  expect(onUploaded.mock.calls[0][0].map((p: Photo) => p.title)).toEqual(["good.png"])
  const bad = screen.getByText("bad.png").closest("li")!
  expect(within(bad).getByText("Failed: Upload failed (500)")).toBeTruthy()
  expect(uploadButton().textContent).toBe("Upload 1 photo")

  fireEvent.click(uploadButton())
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Uploaded 1 photo."))
  expect(upload.mock.calls.filter(([, f]) => f.name === "good.png")).toHaveLength(1)
  expect(upload.mock.calls.filter(([, f]) => f.name === "bad.png")).toHaveLength(2)
  expect(onUploaded).toHaveBeenCalledTimes(2)
})

test("controls are disabled while uploading", async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  const upload = vi.fn(async (albumId: string, f: File) => {
    await gate
    return photoFor(albumId, f)
  })
  render(<PhotoUpload albums={albums} upload={upload} />)
  choose([file("1.png")])
  fireEvent.click(uploadButton())
  expect((screen.getByRole("button", { name: "Select Photos" }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole("button", { name: "Remove 1.png" }) as HTMLButtonElement).disabled).toBe(true)
  release()
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Uploaded 1 photo."))
})

test("Clear uploaded removes finished photos only", async () => {
  const upload = vi.fn(async (albumId: string, f: File) => {
    if (f.name === "bad.png") throw new Error("nope")
    return photoFor(albumId, f)
  })
  render(<PhotoUpload albums={albums} upload={upload} />)
  choose([file("good.png"), file("bad.png")])
  fireEvent.click(uploadButton())
  await waitFor(() => screen.getByRole("button", { name: "Clear uploaded" }))
  fireEvent.click(screen.getByRole("button", { name: "Clear uploaded" }))
  expect(screen.queryByText("good.png")).toBeNull()
  expect(screen.getByText("bad.png")).toBeTruthy()
})

// Navigation

test("hash maps to the right page, defaulting to albums", () => {
  expect(pageFromHash("#/upload")).toBe("upload")
  expect(pageFromHash("#/photos")).toBe("photos")
  expect(pageFromHash("#/gallery")).toBe("albums")
  expect(pageFromHash("#/")).toBe("albums")
  expect(pageFromHash("")).toBe("albums")
  expect(pageFromHash("#/nonsense")).toBe("albums")
})

test("tab bar links to every page and marks the current one", () => {
  render(<AppTabs active="upload" />)
  expect(screen.getByRole("link", { name: "Albums" }).getAttribute("href")).toBe("#/")
  expect(screen.getByRole("link", { name: "Upload" }).getAttribute("href")).toBe("#/upload")
  expect(screen.getByRole("link", { name: "Photos" }).getAttribute("href")).toBe("#/photos")
  expect(screen.getByRole("link", { name: "Upload" }).getAttribute("aria-current")).toBe("page")
  expect(screen.getByRole("link", { name: "Albums" }).getAttribute("aria-current")).toBeNull()
  expect(screen.getByRole("link", { name: "Photos" }).getAttribute("aria-current")).toBeNull()
})
