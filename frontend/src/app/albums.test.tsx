import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"
import type { Album } from "./api.ts"
import { AlbumList } from "./AlbumList.tsx"
import { AlbumPage } from "./AlbumPage.tsx"
import { albumIdFromHash } from "./route.ts"

const albums: Album[] = [
  { id: "opening", title: "Opening ceremony", ownerId: "demo-user" },
  { id: "reception", title: "Reception", ownerId: "demo-user" },
  { id: "a b", title: "Tom & Jerry", ownerId: "demo-user" },
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

test("reads the album id from the hash", () => {
  expect(albumIdFromHash("#/albums/opening")).toBe("opening")
  expect(albumIdFromHash("#/albums/a%20b")).toBe("a b")
  expect(albumIdFromHash("#/")).toBeNull()
  expect(albumIdFromHash("")).toBeNull()
  expect(albumIdFromHash("#/albums/%")).toBeNull()
})
