import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import type { Photo } from "../src/app/api.ts"
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

test("single view offers rotate buttons that turn the photo a quarter turn", () => {
  render(<PhotoGallery photos={photos} />)
  expect(screen.queryByRole("button", { name: "Rotate clockwise" })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Single" }))
  const img = () => screen.getByRole("img", { name: "First photo" }) as HTMLImageElement

  fireEvent.click(screen.getByRole("button", { name: "Rotate clockwise" }))
  expect(img().style.transform).toBe("rotate(90deg)")
  expect(img().className).toContain("is-sideways")

  fireEvent.click(screen.getByRole("button", { name: "Rotate counterclockwise" }))
  fireEvent.click(screen.getByRole("button", { name: "Rotate counterclockwise" }))
  expect(img().style.transform).toBe("rotate(-90deg)")

  fireEvent.click(screen.getByRole("button", { name: "Rotate counterclockwise" }))
  expect(img().style.transform).toBe("rotate(-180deg)")
  expect(img().className).not.toContain("is-sideways")
})

test("each photo keeps its own rotation while browsing", () => {
  render(<PhotoGallery photos={photos} />)
  fireEvent.click(screen.getByRole("button", { name: "Single" }))
  fireEvent.click(screen.getByRole("button", { name: "Rotate clockwise" }))

  fireEvent.click(screen.getByRole("button", { name: "Next photo" }))
  expect((screen.getByRole("img", { name: "Second photo" }) as HTMLImageElement).style.transform).toBe("rotate(0deg)")

  fireEvent.click(screen.getByRole("button", { name: "Previous photo" }))
  expect((screen.getByRole("img", { name: "First photo" }) as HTMLImageElement).style.transform).toBe("rotate(90deg)")
})
