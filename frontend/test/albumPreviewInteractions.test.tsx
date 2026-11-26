import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import type { Album, Photo } from "../src/app/api.ts"
import type { SavedCollage } from "../src/app/collageStore.ts"
import { AlbumPreview } from "../src/app/AlbumPreview.tsx"

const album: Album = { id: "album", title: "Summer trip", ownerId: "demo-user" }
const photos: Photo[] = Array.from({ length: 4 }, (_, index) => ({
  id: `p${index + 1}`,
  src: `/photos/p${index + 1}.jpg`,
  thumbnail: `/thumbs/p${index + 1}.jpg`,
  title: `Photo ${index + 1}`,
  description: "",
  date: "",
  albumId: album.id,
  tags: [],
}))
const collage: SavedCollage = {
  id: "c1",
  albumId: album.id,
  name: "Trip collage",
  templateId: "grid-4",
  photoIds: photos.map((photo) => photo.id),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

test("waits for every source image and disables export after an image fails", () => {
  render(<AlbumPreview album={album} photos={photos} collages={[collage]} />)
  const download = screen.getByRole("button", { name: "Download PNG" })
  expect(download).toBeDisabled()

  for (const photo of photos) fireEvent.load(screen.getByAltText(photo.title))
  expect(download).toBeEnabled()

  fireEvent.error(screen.getByAltText("Photo 2"))
  expect(download).toBeDisabled()
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be loaded")
  expect(screen.getByRole("img", { name: "Photo 2 unavailable" })).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Retry photos" }))
  expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled()
  expect(screen.getByAltText("Photo 2")).toBeInTheDocument()
})

test("allows choosing the requested JPEG export format", () => {
  render(<AlbumPreview album={album} photos={photos} collages={[collage]} />)
  fireEvent.change(screen.getByLabelText("File format"), { target: { value: "jpeg" } })
  expect(screen.getByRole("button", { name: "Download JPEG" })).toBeDisabled()
})

test("shows retry actions for failed photo and saved-collage requests without enabling export", () => {
  const retryPhotos = vi.fn()
  const photoView = render(<AlbumPreview album={album} photos={[]} photoStatus="error" onRetryPhotos={retryPhotos} />)
  expect(screen.getByRole("alert")).toHaveTextContent("saved layouts can’t be previewed or exported")
  fireEvent.click(screen.getByRole("button", { name: "Retry photos" }))
  expect(retryPhotos).toHaveBeenCalledOnce()
  photoView.unmount()

  const retryCollages = vi.fn()
  render(<AlbumPreview album={album} photos={photos} collagesStatus="error" onRetryCollages={retryCollages} />)
  expect(screen.getByRole("alert")).toHaveTextContent("not an exportable collage")
  expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry saved collages" }))
  expect(retryCollages).toHaveBeenCalledOnce()
})
