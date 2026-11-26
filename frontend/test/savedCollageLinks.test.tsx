import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { SavedCollagesPanel } from "../src/app/SavedCollages.tsx"
import type { SavedCollage } from "../src/app/collageStore.ts"
import type { ManagedAlbum, Photo } from "../src/app/AlbumManager.tsx"

const album: ManagedAlbum = {
  id: "event one",
  name: "Event one",
  description: "",
  collaborationEnabled: false,
  collaborators: [],
}

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
  name: "Event highlights",
  templateId: "grid-4",
  photoIds: photos.map((photo) => photo.id),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

test("saved collage view links to the album's full preview and export page", () => {
  render(<SavedCollagesPanel album={album} photos={photos} collages={[collage]} />)
  fireEvent.click(screen.getByRole("button", { name: "Open collage Event highlights" }))

  expect(screen.getByRole("link", { name: "Preview and export album collages" })).toHaveAttribute(
    "href",
    "#/albums/event%20one/preview",
  )
})
