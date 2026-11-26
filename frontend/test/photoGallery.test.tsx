import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import type { Album, Photo } from "../src/app/api.ts"
import { PhotoGallery } from "../src/app/PhotoGallery.tsx"

const photos: Photo[] = [
  {
    id: "one",
    src: "/one-full.jpg",
    thumbnail: "/one-thumb.jpg",
    title: "First photo",
    description: "",
    date: "2026-10-31",
    albumId: "album",
    tags: [],
  },
  {
    id: "two",
    src: "/two-full.jpg",
    thumbnail: "/two-thumb.jpg",
    title: "Second photo",
    description: "",
    date: "2026-10-31",
    albumId: "album",
    tags: [],
  },
  {
    id: "three",
    src: "/three-full.jpg",
    thumbnail: "/three-thumb.jpg",
    title: "Third photo",
    description: "",
    date: "2026-10-31",
    albumId: "album",
    tags: [],
  },
]

test("shows every uploaded photo in the grid", () => {
  render(<PhotoGallery photos={photos} />)

  expect(screen.getByText("3 uploaded photos")).toBeTruthy()
  expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(3)
  expect(screen.getByRole("img", { name: "First photo" }).getAttribute("src")).toBe("/one-thumb.jpg")
})

test("switches to single view and browses with adjacent arrows", () => {
  render(<PhotoGallery photos={photos} />)

  fireEvent.click(screen.getByRole("button", { name: "Single" }))

  const previous = screen.getByRole("button", { name: "Previous photo" }) as HTMLButtonElement
  const next = screen.getByRole("button", { name: "Next photo" }) as HTMLButtonElement
  expect(previous.disabled).toBe(true)
  expect(screen.getByText("1 of 3")).toBeTruthy()

  fireEvent.click(next)
  expect(screen.getByRole("img", { name: "Second photo" }).getAttribute("src")).toBe("/two-full.jpg")
  expect(screen.getByText("2 of 3")).toBeTruthy()

  fireEvent.keyDown(window, { key: "ArrowRight" })
  expect(screen.getByRole("img", { name: "Third photo" })).toBeTruthy()
  expect(next.disabled).toBe(true)

  fireEvent.click(previous)
  expect(screen.getByRole("img", { name: "Second photo" })).toBeTruthy()
})

test("opens a selected grid photo in single view", () => {
  render(<PhotoGallery photos={photos} />)
  fireEvent.click(screen.getByRole("button", { name: "Open Second photo" }))

  expect(screen.getByRole("img", { name: "Second photo" }).getAttribute("src")).toBe("/two-full.jpg")
  expect(screen.getByText("2 of 3")).toBeTruthy()
})

test("shows an upload path when the gallery is empty", () => {
  render(<PhotoGallery photos={[]} />)

  expect(screen.getByText("No photos yet")).toBeTruthy()
  expect(screen.getByRole("link", { name: "Upload photos" }).getAttribute("href")).toBe("#/upload")
})

test("single view shows counter-clockwise and clockwise rotate buttons in the stage border and allows reverting", () => {
  render(<PhotoGallery photos={photos} onSaveRotation={vi.fn()} />)

  expect(screen.queryByRole("button", { name: "Rotate counter-clockwise" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Rotate clockwise" })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Single" }))

  const stage = document.querySelector(".pg-stage")
  const ccw = screen.getByRole("button", { name: "Rotate counter-clockwise" })
  const cw = screen.getByRole("button", { name: "Rotate clockwise" })
  expect(stage?.contains(ccw)).toBe(true)
  expect(stage?.contains(cw)).toBe(true)

  const img = () => screen.getByRole("img", { name: "First photo" }) as HTMLImageElement

  fireEvent.click(cw)
  expect(img().style.transform).toBe("translate(-50%, -50%) rotate(90deg)")
  expect(img().className).toContain("is-sideways")
  expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Revert" })).toBeTruthy()

  fireEvent.click(ccw)
  fireEvent.click(ccw)
  expect(img().style.transform).toBe("translate(-50%, -50%) rotate(-90deg)")
  expect(img().className).toContain("is-sideways")

  fireEvent.click(ccw)
  expect(img().style.transform).toBe("translate(-50%, -50%) rotate(-180deg)")
  expect(img().className).not.toContain("is-sideways")

  fireEvent.click(screen.getByRole("button", { name: "Revert" }))
  expect(img().style.transform).toBe("translate(-50%, -50%) rotate(0deg)")
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Revert" })).toBeNull()
})

test("rotating a full circle clears pending changes without requiring revert", () => {
  render(<PhotoGallery photos={photos} onSaveRotation={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Single" }))
  const cw = screen.getByRole("button", { name: "Rotate clockwise" })

  for (let i = 0; i < 4; i++) fireEvent.click(cw)
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Revert" })).toBeNull()
})

test("saving a rotation calls onSaveRotation with normalized degrees and resets pending state", async () => {
  let resolveSave!: () => void
  const onSaveRotation = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve }))
  render(<PhotoGallery photos={photos} onSaveRotation={onSaveRotation} />)

  fireEvent.click(screen.getByRole("button", { name: "Single" }))
  fireEvent.click(screen.getByRole("button", { name: "Rotate counter-clockwise" }))
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

  expect(onSaveRotation).toHaveBeenCalledWith(photos[0], 270)
  expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole("button", { name: "Rotate clockwise" }) as HTMLButtonElement).disabled).toBe(true)

  resolveSave()
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Rotation saved"))
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull()
  expect((screen.getByRole("img", { name: "First photo" }) as HTMLImageElement).style.transform).toBe(
    "translate(-50%, -50%) rotate(0deg)",
  )
})

test("failed rotation save keeps pending orientation and shows an error for retry or revert", async () => {
  const onSaveRotation = vi.fn().mockRejectedValue(new Error("Server unavailable"))
  render(<PhotoGallery photos={photos} onSaveRotation={onSaveRotation} />)

  fireEvent.click(screen.getByRole("button", { name: "Single" }))
  fireEvent.click(screen.getByRole("button", { name: "Rotate clockwise" }))
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Server unavailable"))
  expect((screen.getByRole("img", { name: "First photo" }) as HTMLImageElement).style.transform).toBe(
    "translate(-50%, -50%) rotate(90deg)",
  )
  expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Revert" }))
  expect(screen.queryByRole("alert")).toBeNull()
})

test("single view shows image name and album membership above the gray frame and removes the name below the photo", () => {
  const albums: Album[] = [
    { id: "opening", title: "Opening ceremony", ownerId: "demo-user" },
    { id: "reception", title: "Reception", ownerId: "demo-user" },
  ]
  const libraryPhotos: Photo[] = [
    { ...photos[0], albumId: "opening", albumIds: ["opening"] },
    { ...photos[1], albumId: "", albumIds: [] },
    { ...photos[2], albumId: "opening", albumIds: ["opening", "reception"] },
  ]

  const { container } = render(<PhotoGallery photos={libraryPhotos} albums={albums} />)
  fireEvent.click(screen.getByRole("button", { name: "Single" }))

  const meta = container.querySelector(".pg-single-meta")!
  const stage = container.querySelector(".pg-stage")!
  const caption = container.querySelector(".pg-figure figcaption")!

  expect(meta).toBeTruthy()
  expect(stage.contains(meta)).toBe(false)
  expect(meta.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(meta.textContent).toContain("First photo")
  expect(meta.textContent).toContain("Album: Opening ceremony")
  expect(caption.textContent).not.toContain("First photo")
  expect(caption.textContent).toContain("1 of 3")

  fireEvent.click(screen.getByRole("button", { name: "Next photo" }))
  expect(meta.textContent).toContain("Second photo")
  expect(meta.textContent).toContain("No album")
  expect(caption.textContent).not.toContain("Second photo")

  fireEvent.click(screen.getByRole("button", { name: "Next photo" }))
  expect(meta.textContent).toContain("Third photo")
  expect(meta.textContent).toContain("Albums: Opening ceremony, Reception")
})
