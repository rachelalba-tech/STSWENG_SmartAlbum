import { renderToStaticMarkup } from "react-dom/server"
import { expect, test, vi } from "vitest"
import type { ComponentProps } from "react"
import { AlbumCollage } from "../src/app/AlbumCollage.tsx"

type Photo = ComponentProps<typeof AlbumCollage>["photos"][number]

const makePhotos = (count: number): Photo[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    title: `Photo ${index + 1}`,
    src: `/photos/photo-${index + 1}.jpg`,
  })) as Photo[]

test("shows an empty-album message when there are no photos", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={[]} />)

  expect(html).toContain("Can&#x27;t make a collage from this album")
  expect(html).toContain("This album has 0 photos")
  expect(html).toContain("Add photos to the album to get started.")
  expect(html).not.toContain('class="ac-stage"')
})

test("explains how to reach a supported layout when there are too few photos", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(2)} />)

  expect(html).toContain("This album has 2 photos")
  expect(html).toContain("add 1 photo for a 3-photo layout")
})

test("suggests adding or removing photos when the count is between supported counts", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(5)} />)

  expect(html).toContain("This album has 5 photos")
  expect(html).toContain("add 1 photo for a 6-photo layout")
  expect(html).toContain("remove 1 photo for a 4-photo layout")
})

test("suggests removing a photo when the count is above the largest supported layout", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(10)} />)

  expect(html).toContain("This album has 10 photos")
  expect(html).toContain("remove 1 photo for a 9-photo layout")
})

test("renders a collage with the correct photos when the count is supported", () => {
  const photos = makePhotos(3)
  const html = renderToStaticMarkup(<AlbumCollage photos={photos} />)

  expect(html).toContain('class="ac-stage"')
  expect(html.match(/<img /g)).toHaveLength(3)

  for (const photo of photos) {
    expect(html).toContain(`src="${photo.src}"`)
    expect(html).toContain(`alt="${photo.title}"`)
  }
})

test("renders a layout picker when multiple templates support the photo count", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(4)} />)

  expect(html).toContain('role="radiogroup"')
  expect(html).toContain('aria-label="Collage layout"')
  expect(html).toContain('role="radio"')
  expect(html).toContain('aria-label="Four grid"')
  expect(html).toContain('aria-label="One over three"')
})

test("does not render a layout picker when only one template matches", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(3)} />)

  expect(html).not.toContain('role="radiogroup"')
})

test("renders editable photo slots with accessible labels and selection state", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(3)} />)

  expect(html).toContain('role="button"')
  expect(html).toContain('aria-label="Photo 1, position 1"')
  expect(html).toContain('aria-pressed="false"')
  expect(html).toContain("Drag a photo onto another to swap them")
})

test("renders the close button when an onClose callback is provided", () => {
  const onClose = vi.fn()
  const html = renderToStaticMarkup(
    <AlbumCollage photos={makePhotos(3)} onClose={onClose} />,
  )

  expect(html).toContain(">Close</button>")
})

test("does not render the close button when onClose is omitted", () => {
  const html = renderToStaticMarkup(<AlbumCollage photos={makePhotos(3)} />)

  expect(html).not.toContain(">Close</button>")
})

test("renders an OK button for an unsupported photo count when onClose is provided", () => {
  const html = renderToStaticMarkup(
    <AlbumCollage photos={makePhotos(2)} onClose={() => {}} />,
  )

  expect(html).toContain(">OK</button>")
})
