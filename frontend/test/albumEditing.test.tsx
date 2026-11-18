import { afterEach, beforeAll, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { AlbumManager } from "../src/app/AlbumManager.tsx"
import { AlbumPage } from "../src/app/AlbumPage.tsx"
import type { Photo } from "../src/app/api.ts"

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
afterEach(cleanup)
const album = { id: "a", title: "Event", description: "Opening", ownerId: "demo-user" }
const photos: Photo[] = ["one", "two"].map((id) => ({ id, src: `${id}.png`, thumbnail: `${id}.png`, title: id, description: "", date: "", albumId: "a", tags: [] }))

test("create failure keeps the title/dialog for retry instead of showing an unsaved album", async () => {
  const create = vi.fn().mockRejectedValueOnce(new Error("Disk full")).mockResolvedValue(undefined)
  render(<AlbumManager albums={[]} photos={[]} onAlbumCreate={create} onAlbumUpdate={() => {}} onAlbumSelect={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "New album" }))
  fireEvent.change(screen.getByLabelText("Album name"), { target: { value: "New event" } })
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create album" }))
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Disk full"))
  expect((screen.getByLabelText("Album name") as HTMLInputElement).value).toBe("New event")
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create album" }))
  await waitFor(() => expect(screen.queryByLabelText("Album name")).toBeNull())
  expect(create).toHaveBeenCalledTimes(2)
})

test("photo reorder supports keyboard-accessible buttons and only saves on confirmation", async () => {
  const reorder = vi.fn().mockResolvedValue(undefined)
  const { container } = render(<AlbumPage album={album} photos={photos} onReorder={reorder} />)
  fireEvent.click(screen.getByText("Edit photo order"))
  fireEvent.click(screen.getByRole("button", { name: "Move two earlier" }))
  expect([...container.querySelectorAll(".photos img")].map((img) => img.getAttribute("alt"))).toEqual(["two", "one"])
  expect(reorder).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText("Save photo order"))
  await waitFor(() => expect(reorder).toHaveBeenCalledWith(["two", "one"]))
})

test("details and adding library photos use the save handlers and show errors", async () => {
  const update = vi.fn().mockRejectedValue(new Error("Save failed"))
  const add = vi.fn().mockResolvedValue(undefined)
  render(<AlbumPage album={album} photos={[photos[0]]} library={photos} onUpdate={update} onAdd={add} />)
  fireEvent.click(screen.getByText("Edit album details"))
  fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "New headline" } })
  fireEvent.click(screen.getByText("Save details"))
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Save failed"))
  expect(update).toHaveBeenCalledWith("New headline", "Opening")
  fireEvent.click(screen.getByText("Add photos from library"))
  expect(screen.getAllByRole("checkbox")).toHaveLength(1)
  fireEvent.click(screen.getByRole("checkbox", { name: "two" }))
  fireEvent.click(screen.getByText("Add selected photos"))
  await waitFor(() => expect(add).toHaveBeenCalledWith(["two"]))
})

test("album grid and single view keep removal controls and disable them during saves", async () => {
  const remove = vi.fn().mockResolvedValue(undefined)
  render(<AlbumPage album={album} photos={photos} onRemove={remove} />)
  fireEvent.click(screen.getByRole("button", { name: "Remove one from album" }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith("one"))
  await waitFor(() => expect((screen.getByRole("button", { name: "Remove two from album" }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole("button", { name: "Open two" }))
  fireEvent.click(screen.getByRole("button", { name: "Remove two from album" }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith("two"))
})
