import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"
import type { Album, Photo } from "../src/app/api.ts"
import type { SavedCollage } from "../src/app/collageStore.ts"
import { AlbumPage } from "../src/app/AlbumPage.tsx"
import { AlbumPreview } from "../src/app/AlbumPreview.tsx"
import { albumIdFromHash, previewAlbumIdFromHash } from "../src/app/route.ts"

const album: Album = { id: "a b", title: "Summer trip", ownerId: "demo-user" }

const photos: Photo[] = [
  { id: "p1", src: "/full/p1.jpg", thumbnail: "/thumb/p1.jpg", title: "Beach", description: "", date: "", albumId: "a b", tags: [] },
  { id: "p2", src: "/full/p2.jpg", thumbnail: "/thumb/p2.jpg", title: "", description: "", date: "", albumId: "a b", tags: [] },
  { id: "p3", src: "/full/p3.jpg", thumbnail: "/thumb/p3.jpg", title: "Sunset", description: "", date: "", albumId: "a b", tags: [] },
]

const savedCollage: SavedCollage = {
  id: "c1",
  albumId: album.id,
  name: "Beach story",
  templateId: "grid-4",
  photoIds: ["p3", "p1", "p2", "missing"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

test("preview shows the title and every full-size photo in order", () => {
  const html = renderToStaticMarkup(<AlbumPreview album={album} photos={photos} />)
  expect(html).toContain('aria-label="Album preview"')
  expect(html).toContain("<h2>Summer trip</h2>")
  const srcs = [...html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1])
  expect(srcs).toEqual(photos.map((p) => p.src))
  expect(html).not.toContain("/thumb/")
  expect(html).toContain('alt="Beach"')
  expect(html).toContain('alt="Photo"')
})

test("preview is read-only and its only link is back to the album", () => {
  const html = renderToStaticMarkup(<AlbumPreview album={album} photos={photos} />)
  const page = html.slice(html.indexOf("<article"), html.indexOf("</article>"))
  expect(page).not.toMatch(/<(a|button|input|textarea|select)[\s>]|contenteditable/i)
  expect(html.match(/href="[^"]*"/g)).toEqual(['href="#/albums/a%20b"'])
})

test("empty album says there is nothing to preview yet", () => {
  const html = renderToStaticMarkup(<AlbumPreview album={album} photos={[]} />)
  expect(html).toContain("No photos to preview yet.")
  expect(html).toContain("No saved collages yet")
  expect(html).not.toContain("<img")
})

test("saved collage preview follows the saved template and photo order without claiming missing slots are exportable", () => {
  const html = renderToStaticMarkup(<AlbumPreview album={album} photos={photos} collages={[savedCollage]} />)
  const container = document.createElement("div")
  container.innerHTML = html
  const srcs = [...container.querySelectorAll(".ac-stage img")].map((image) => image.getAttribute("src"))

  expect(srcs).toEqual([photos[2].src, photos[0].src, photos[1].src])
  expect(html).toContain('alt="Photo"')
  expect(html).toContain('aria-label="Saved collage Beach story"')
  expect(html).toContain("1 saved photo is no longer in this album")
  expect(html).toContain('>Download PNG</button>')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Download PNG<\/button>/)
  expect(html).not.toContain("No saved collages yet")
})

test("preview waits for saved collage loading instead of showing a false no-collages fallback", () => {
  const html = renderToStaticMarkup(<AlbumPreview album={album} photos={photos} collagesStatus="loading" />)
  expect(html).toContain("Loading saved collages…")
  expect(html).not.toContain("No saved collages yet")
  expect(html).not.toContain("Download PNG")
})

test("unknown saved template is reported and has no export control", () => {
  const html = renderToStaticMarkup(
    <AlbumPreview album={album} photos={photos} collages={[{ ...savedCollage, templateId: "retired" }]} />,
  )
  expect(html).toContain("layout is no longer available")
  expect(html).not.toContain("Download PNG")
})

test("reads the album id from the preview hash", () => {
  expect(previewAlbumIdFromHash("#/albums/opening/preview")).toBe("opening")
  expect(previewAlbumIdFromHash("#/albums/a%20b/preview")).toBe("a b")
  expect(previewAlbumIdFromHash("#/albums/opening")).toBeNull()
  expect(previewAlbumIdFromHash("#/albums/%/preview")).toBeNull()
  expect(albumIdFromHash("#/albums/opening/preview")).toBeNull()
})

test("opened album links to its preview", () => {
  const html = renderToStaticMarkup(<AlbumPage album={album} />)
  expect(html).toContain('href="#/albums/a%20b/preview"')
  expect(html).toContain("Preview and export album")
})
