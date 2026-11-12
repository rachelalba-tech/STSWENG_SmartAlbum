import { fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"
import type { Album, Photo } from "../src/app/api.ts"
import { AlbumList } from "../src/app/AlbumList.tsx"
import { AlbumPage } from "../src/app/AlbumPage.tsx"
import { albumIdFromHash } from "../src/app/route.ts"
const albums: Album[] = [
  { id: "opening", title: "Opening ceremony", ownerId: "demo-user" },
  { id: "reception", title: "Reception", ownerId: "demo-user" },
  { id: "a b", title: "Tom & Jerry", ownerId: "demo-user" },
]
const photos: Photo[] = [
  {
    id: "first",
    src: "/first-full.jpg",
    thumbnail: "/first-thumb.jpg",
    title: "First album photo",
    description: "",
    date: "2026-10-31",
    albumId: "opening",
    tags: [],
  },
  {
    id: "second",
    src: "/second-full.jpg",
    thumbnail: "/second-thumb.jpg",
    title: "Second album photo",
    description: "",
    date: "2026-10-31",
    albumId: "opening",
    tags: [],
  },
]

test("shows every album as a link that opens it", () => {
  const html = renderToStaticMarkup(<AlbumList albums={albums} />)
  expect(html.match(/<a /g)).toHaveLength(albums.length)
  for (const album of albums) {
    expect(html).toContain(`href="#/albums/${encodeURIComponent(album.id)}"`)
    expect(html).toContain(album.title === "Tom & Jerry" ? "Tom &amp; Jerry" : album.title)
  }
})

test("shows an empty state when the user has no albums", () => {
  expect(renderToStaticMarkup(<AlbumList albums={[]} />)).toContain("No albums yet.")
})

test("opened album shows its title and a way back", () => {
  const html = renderToStaticMarkup(<AlbumPage album={albums[0]} />)
  expect(html).toContain("Opening ceremony")
  expect(html).toContain('href="#/"')
})

test("opened album offers the same grid and single-photo views", () => {
  render(<AlbumPage album={albums[0]} photos={photos} />)

  expect(screen.getByText("2 photos in this album")).toBeTruthy()
  expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(2)

  fireEvent.click(screen.getByRole("button", { name: "Single" }))
  expect(screen.getByRole("img", { name: "First album photo" }).getAttribute("src")).toBe(
    "/first-full.jpg",
  )

  fireEvent.click(screen.getByRole("button", { name: "Next photo" }))
  expect(screen.getByRole("img", { name: "Second album photo" })).toBeTruthy()
  expect(screen.getByText("2 of 2")).toBeTruthy()
})

test("opened empty album uses the album-specific empty state", () => {
  render(<AlbumPage album={albums[0]} photos={[]} />)

  expect(screen.getByText("No photos in this album")).toBeTruthy()
  expect(screen.getByText("Upload photos to this album and they will appear here.")).toBeTruthy()
})

test("reads the album id from the hash", () => {
  expect(albumIdFromHash("#/albums/opening")).toBe("opening")
  expect(albumIdFromHash("#/albums/a%20b")).toBe("a b")
  expect(albumIdFromHash("#/")).toBeNull()
  expect(albumIdFromHash("")).toBeNull()
  expect(albumIdFromHash("#/albums/%")).toBeNull()
})
