// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { AlbumManager } from "../src/app/AlbumManager.tsx"
import type { Collaborator, ManagedAlbum, Photo } from "../src/app/AlbumManager.tsx"

// AlbumManager's dialogs are portaled, so renderToStaticMarkup can't render them. These tests
// use a DOM instead. jsdom does not implement <dialog>.showModal()/close(), so add minimal versions.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute("open")) return
    this.removeAttribute("open")
    this.dispatchEvent(new Event("close"))
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Fixtures

const photo = (id: string, albumId: string, title = `Photo ${id}`): Photo => ({
  id,
  src: `/full/${id}.jpg`,
  thumbnail: `/thumb/${id}.jpg`,
  title,
  description: "",
  date: "2024-01-01",
  albumId,
  tags: [],
})

const person = (id: string, name: string, role: Collaborator["role"] = "viewer"): Collaborator => ({
  id,
  name,
  username: `@${name.toLowerCase().replace(/\s+/g, "")}`,
  avatar: `/avatar/${id}.png`,
  role,
})

const album = (over: Partial<ManagedAlbum> = {}): ManagedAlbum => ({
  id: "opening",
  name: "Opening ceremony",
  description: "",
  collaborationEnabled: false,
  collaborators: [],
  ...over,
})

type Handlers = {
  onAlbumCreate: ReturnType<typeof vi.fn>
  onAlbumSelect: ReturnType<typeof vi.fn>
  onAlbumUpdate: ReturnType<typeof vi.fn>
}

function setup(albums: ManagedAlbum[], photos: Photo[] = []) {
  const handlers: Handlers = {
    onAlbumCreate: vi.fn(),
    onAlbumSelect: vi.fn(),
    onAlbumUpdate: vi.fn(),
  }
  const utils = render(<AlbumManager albums={albums} photos={photos} {...handlers} />)
  return { ...handlers, ...utils }
}

const card = (name: string) => screen.getByRole("link", { name: `Open ${name}` })
const openDialogEl = () => document.querySelector("dialog[open]") as HTMLDialogElement | null
const dialog = () => {
  const el = openDialogEl()
  if (!el) throw new Error("No dialog is open")
  return within(el)
}
const openFromCard = (name: string, buttonLabel: string) => {
  fireEvent.click(within(card(name)).getByRole("button", { name: buttonLabel }))
  return dialog()
}
const stats = () =>
  Object.fromEntries(
    [...document.querySelectorAll(".am-stat")].map((el) => [
      el.querySelector("span")!.textContent,
      el.querySelector("strong")!.textContent,
    ]),
  )

// Listing

test("shows every album as a card that opens it", () => {
  const albums = [
    album({ id: "opening", name: "Opening ceremony" }),
    album({ id: "reception", name: "Reception" }),
    album({ id: "a b", name: "Tom & Jerry" }),
  ]
  setup(albums)
  expect(screen.getAllByRole("link")).toHaveLength(albums.length)
  for (const a of albums) expect(card(a.name)).toBeTruthy()
})

test("shows an empty state when the user has no albums", () => {
  setup([])
  expect(screen.getByText("No albums yet")).toBeTruthy()
  expect(screen.queryAllByRole("link")).toHaveLength(0)
})

test("empty state button opens the create dialog", () => {
  setup([])
  fireEvent.click(screen.getByRole("button", { name: "Create album" }))
  expect(dialog().getByText("Create new album")).toBeTruthy()
})

test("shows the description only when the album has one", () => {
  setup([
    album({ id: "a", name: "With", description: "Day one" }),
    album({ id: "b", name: "Without", description: "" }),
  ])
  expect(within(card("With")).getByText("Day one")).toBeTruthy()
  expect(card("Without").querySelector(".am-card-desc")).toBeNull()
})

test("badge counts photos with correct singular and plural", () => {
  setup(
    [album({ id: "a", name: "One" }), album({ id: "b", name: "Two" }), album({ id: "c", name: "None" })],
    [photo("1", "a"), photo("2", "b"), photo("3", "b")],
  )
  expect(within(card("One")).getByText("1 photo")).toBeTruthy()
  expect(within(card("Two")).getByText("2 photos")).toBeTruthy()
  expect(within(card("None")).getByText("0 photos")).toBeTruthy()
})

test("collection overview shows totals, largest album and rounded average", () => {
  setup(
    [album({ id: "a", name: "A" }), album({ id: "b", name: "B" })],
    [photo("1", "a"), photo("2", "b"), photo("3", "b")],
  )
  expect(stats()).toEqual({ Albums: "2", "Total photos": "3", "Largest album": "2", "Avg per album": "2" })
})

test("collection overview does not divide by zero with no albums", () => {
  setup([])
  expect(stats()).toEqual({ Albums: "0", "Total photos": "0", "Largest album": "0", "Avg per album": "0" })
})

// Covers

test("cover is the chosen cover photo, else the first photo, else a placeholder", () => {
  const photos = [photo("1", "a"), photo("2", "a"), photo("3", "b")]
  setup([
    album({ id: "a", name: "Chosen", coverPhoto: photos[1] }),
    album({ id: "b", name: "First" }),
    album({ id: "c", name: "Empty" }),
  ], photos)
  expect(within(card("Chosen")).getByAltText("Chosen").getAttribute("src")).toBe("/thumb/2.jpg")
  expect(within(card("First")).getByAltText("First").getAttribute("src")).toBe("/thumb/3.jpg")
  expect(card("Empty").querySelector("img")).toBeNull()
  expect(card("Empty").querySelector(".am-cover-empty")).not.toBeNull()
})

test("cover dialog says so when the album has no photos", () => {
  setup([album({ id: "a", name: "A" })], [photo("1", "other")])
  const d = openFromCard("A", "Choose album cover")
  expect(d.getByText("No photos in this album yet.")).toBeTruthy()
})

test("cover dialog lists only this album's photos and marks the current cover", () => {
  const photos = [photo("1", "a", "Sunrise"), photo("2", "a", "Cake"), photo("3", "b", "Other")]
  setup([album({ id: "a", name: "A", coverPhoto: photos[1] })], photos)
  const d = openFromCard("A", "Choose album cover")
  expect(d.getByRole("button", { name: "Use Sunrise as cover" })).toBeTruthy()
  expect(d.getByRole("button", { name: "Use Cake as cover" })).toBeTruthy()
  expect(d.queryByRole("button", { name: "Use Other as cover" })).toBeNull()
  expect(d.getAllByText("Cover")).toHaveLength(1)
  expect(within(d.getByRole("button", { name: "Use Cake as cover" })).getByText("Cover")).toBeTruthy()
})

test("picking a cover updates the album and closes the dialog", () => {
  const photos = [photo("1", "a", "Sunrise")]
  const a = album({ id: "a", name: "A" })
  const { onAlbumUpdate } = setup([a], photos)
  fireEvent.click(openFromCard("A", "Choose album cover").getByRole("button", { name: "Use Sunrise as cover" }))
  expect(onAlbumUpdate).toHaveBeenCalledWith({ ...a, coverPhoto: photos[0] })
  expect(openDialogEl()).toBeNull()
})

// Selecting

test("clicking a card selects that album", () => {
  const { onAlbumSelect } = setup([album({ id: "a b", name: "A" })])
  fireEvent.click(card("A"))
  expect(onAlbumSelect).toHaveBeenCalledExactlyOnceWith("a b")
})

test("Enter and Space on a focused card select it, other keys do not", () => {
  const { onAlbumSelect } = setup([album({ id: "a", name: "A" })])
  fireEvent.keyDown(card("A"), { key: "Enter" })
  fireEvent.keyDown(card("A"), { key: " " })
  expect(onAlbumSelect).toHaveBeenCalledTimes(2)
  fireEvent.keyDown(card("A"), { key: "x" })
  expect(onAlbumSelect).toHaveBeenCalledTimes(2)
})

test("keys pressed on a button inside the card do not select it", () => {
  const { onAlbumSelect } = setup([album({ id: "a", name: "A" })])
  fireEvent.keyDown(within(card("A")).getByRole("button", { name: "Rename album" }), { key: "Enter" })
  expect(onAlbumSelect).not.toHaveBeenCalled()
})

test("action buttons do not trigger card selection", () => {
  const { onAlbumSelect } = setup([album({ id: "a", name: "A" })])
  for (const label of ["Manage collaborators", "Choose album cover", "Rename album", "Delete album"]) {
    fireEvent.click(within(card("A")).getByRole("button", { name: label }))
    openDialogEl()?.close()
  }
  expect(onAlbumSelect).not.toHaveBeenCalled()
})

// Create

test("New album opens a dialog with Create disabled until a name is typed", () => {
  setup([album()])
  fireEvent.click(screen.getByRole("button", { name: /New album/ }))
  const d = dialog()
  const create = d.getByRole("button", { name: "Create album" }) as HTMLButtonElement
  expect(create.disabled).toBe(true)
  fireEvent.change(d.getByLabelText("Album name"), { target: { value: "   " } })
  expect(create.disabled).toBe(true)
  fireEvent.change(d.getByLabelText("Album name"), { target: { value: "Trip" } })
  expect(create.disabled).toBe(false)
})

test("creating an album sends trimmed values, defaults, and closes the dialog", () => {
  vi.spyOn(Date, "now").mockReturnValue(1234)
  const { onAlbumCreate } = setup([album()])
  fireEvent.click(screen.getByRole("button", { name: /New album/ }))
  const d = dialog()
  fireEvent.change(d.getByLabelText("Album name"), { target: { value: "  Beach day  " } })
  fireEvent.change(d.getByLabelText("Description (optional)"), { target: { value: "  Sunny  " } })
  fireEvent.click(d.getByRole("button", { name: "Create album" }))
  expect(onAlbumCreate).toHaveBeenCalledExactlyOnceWith({
    id: "1234",
    name: "Beach day",
    description: "Sunny",
    collaborationEnabled: false,
    collaborators: [],
  })
  expect(openDialogEl()).toBeNull()
})

test("pressing Enter in the name field creates the album", () => {
  const { onAlbumCreate } = setup([album()])
  fireEvent.click(screen.getByRole("button", { name: /New album/ }))
  const input = dialog().getByLabelText("Album name")
  fireEvent.change(input, { target: { value: "Trip" } })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(onAlbumCreate).toHaveBeenCalledTimes(1)
})

test("Enter with a blank name does not create an album", () => {
  const { onAlbumCreate } = setup([album()])
  fireEvent.click(screen.getByRole("button", { name: /New album/ }))
  fireEvent.keyDown(dialog().getByLabelText("Album name"), { key: "Enter" })
  expect(onAlbumCreate).not.toHaveBeenCalled()
})

test("cancelling create closes the dialog without creating", () => {
  const { onAlbumCreate } = setup([album()])
  fireEvent.click(screen.getByRole("button", { name: /New album/ }))
  fireEvent.click(dialog().getByRole("button", { name: "Cancel" }))
  expect(openDialogEl()).toBeNull()
  expect(onAlbumCreate).not.toHaveBeenCalled()
})

test("the close button dismisses a dialog", () => {
  setup([album()])
  fireEvent.click(screen.getByRole("button", { name: /New album/ }))
  fireEvent.click(dialog().getByRole("button", { name: "Close" }))
  expect(openDialogEl()).toBeNull()
})

// Rename

test("rename dialog is prefilled with the album's name and description", () => {
  setup([album({ id: "a", name: "A", description: "Desc" })])
  const d = openFromCard("A", "Rename album")
  expect((d.getByLabelText("Album name") as HTMLInputElement).value).toBe("A")
  expect((d.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Desc")
})

test("saving a rename sends trimmed values and keeps the other fields", () => {
  const a = album({
    id: "a",
    name: "A",
    collaborationEnabled: true,
    collaborators: [person("c1", "Riley Kim")],
  })
  const { onAlbumUpdate } = setup([a])
  const d = openFromCard("A", "Rename album")
  fireEvent.change(d.getByLabelText("Album name"), { target: { value: "  Renamed " } })
  fireEvent.change(d.getByLabelText("Description"), { target: { value: " New desc " } })
  fireEvent.click(d.getByRole("button", { name: "Save" }))
  expect(onAlbumUpdate).toHaveBeenCalledExactlyOnceWith({ ...a, name: "Renamed", description: "New desc" })
  expect(openDialogEl()).toBeNull()
})

test("rename cannot be saved with a blank name", () => {
  const { onAlbumUpdate } = setup([album({ id: "a", name: "A" })])
  const d = openFromCard("A", "Rename album")
  const input = d.getByLabelText("Album name")
  fireEvent.change(input, { target: { value: "  " } })
  expect((d.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.keyDown(input, { key: "Enter" })
  expect(onAlbumUpdate).not.toHaveBeenCalled()
})

test("cancelling a rename discards edits, and reopening shows the saved name again", () => {
  const { onAlbumUpdate } = setup([album({ id: "a", name: "A" })])
  let d = openFromCard("A", "Rename album")
  fireEvent.change(d.getByLabelText("Album name"), { target: { value: "Changed" } })
  fireEvent.click(d.getByRole("button", { name: "Cancel" }))
  expect(onAlbumUpdate).not.toHaveBeenCalled()
  d = openFromCard("A", "Rename album")
  expect((d.getByLabelText("Album name") as HTMLInputElement).value).toBe("A")
})

// Collaborators

test("collaborator controls are hidden until collaboration is enabled", () => {
  setup([album({ id: "a", name: "A", collaborationEnabled: false })])
  const d = openFromCard("A", "Manage collaborators")
  expect(d.getByRole("switch", { name: "Toggle collaboration" }).getAttribute("aria-checked")).toBe("false")
  expect(d.queryByLabelText("Role")).toBeNull()
  expect(d.queryByRole("button", { name: "Send invite" })).toBeNull()
})

test("the switch turns collaboration on and off", () => {
  const off = album({ id: "a", name: "A" })
  const { onAlbumUpdate, rerender } = setup([off])
  fireEvent.click(openFromCard("A", "Manage collaborators").getByRole("switch"))
  expect(onAlbumUpdate).toHaveBeenLastCalledWith({ ...off, collaborationEnabled: true })

  const on = { ...off, collaborationEnabled: true }
  rerender(
    <AlbumManager albums={[on]} photos={[]} onAlbumCreate={vi.fn()} onAlbumSelect={vi.fn()} onAlbumUpdate={onAlbumUpdate} />,
  )
  const d = dialog()
  expect(d.getByRole("switch").getAttribute("aria-checked")).toBe("true")
  fireEvent.click(d.getByRole("switch"))
  expect(onAlbumUpdate).toHaveBeenLastCalledWith({ ...on, collaborationEnabled: false })
})

test("with collaboration on and nobody invited, the dialog shows an empty hint", () => {
  setup([album({ id: "a", name: "A", collaborationEnabled: true })])
  const d = openFromCard("A", "Manage collaborators")
  expect(d.getByText("No collaborators yet")).toBeTruthy()
  expect(d.getByText("Invite someone above to get started")).toBeTruthy()
})

test("the dialog counts collaborators with correct singular and plural", () => {
  const one = album({ id: "a", name: "One", collaborationEnabled: true, collaborators: [person("1", "Riley Kim")] })
  const two = album({
    id: "b",
    name: "Two",
    collaborationEnabled: true,
    collaborators: [person("1", "Riley Kim"), person("2", "Drew Hassan")],
  })
  setup([one, two])
  expect(openFromCard("One", "Manage collaborators").getByText("1 collaborator")).toBeTruthy()
  openDialogEl()!.close()
  expect(openFromCard("Two", "Manage collaborators").getByText("2 collaborators")).toBeTruthy()
})

test("inviting a known person uses their profile with the chosen role", () => {
  const a = album({ id: "a", name: "A", collaborationEnabled: true })
  const { onAlbumUpdate } = setup([a])
  const d = openFromCard("A", "Manage collaborators")
  fireEvent.change(d.getByLabelText("Role"), { target: { value: "editor" } })
  fireEvent.change(d.getByPlaceholderText("@username or name..."), { target: { value: "  RILEY KIM " } })
  fireEvent.click(d.getByRole("button", { name: "Send invite" }))
  const [updated] = onAlbumUpdate.mock.calls[0] as [ManagedAlbum]
  expect(updated.collaborators).toHaveLength(1)
  expect(updated.collaborators[0]).toMatchObject({ id: "ci1", name: "Riley Kim", username: "@rileykim", role: "editor" })
})

test("inviting by @username also matches the known pool", () => {
  const { onAlbumUpdate } = setup([album({ id: "a", name: "A", collaborationEnabled: true })])
  const d = openFromCard("A", "Manage collaborators")
  fireEvent.change(d.getByPlaceholderText("@username or name..."), { target: { value: "@drewhassan" } })
  fireEvent.click(d.getByRole("button", { name: "Send invite" }))
  const [updated] = onAlbumUpdate.mock.calls[0] as [ManagedAlbum]
  expect(updated.collaborators[0]).toMatchObject({ id: "ci2", name: "Drew Hassan", role: "viewer" })
})

test("inviting an unknown person builds a username from what was typed", () => {
  const { onAlbumUpdate } = setup([album({ id: "a", name: "A", collaborationEnabled: true })])
  const d = openFromCard("A", "Manage collaborators")
  fireEvent.change(d.getByPlaceholderText("@username or name..."), { target: { value: "Sam  Lee" } })
  fireEvent.click(d.getByRole("button", { name: "Send invite" }))
  const [updated] = onAlbumUpdate.mock.calls[0] as [ManagedAlbum]
  expect(updated.collaborators[0]).toMatchObject({
    id: expect.stringMatching(/^new-/),
    name: "Sam  Lee",
    username: "@samlee",
    role: "viewer",
  })
})

test("existing collaborators are kept when someone new is invited", () => {
  const existing = person("c1", "Alex Roe")
  const { onAlbumUpdate } = setup([album({ id: "a", name: "A", collaborationEnabled: true, collaborators: [existing] })])
  const d = openFromCard("A", "Manage collaborators")
  fireEvent.change(d.getByPlaceholderText("@username or name..."), { target: { value: "Casey Nguyen" } })
  fireEvent.click(d.getByRole("button", { name: "Send invite" }))
  const [updated] = onAlbumUpdate.mock.calls[0] as [ManagedAlbum]
  expect(updated.collaborators.map((c) => c.id)).toEqual(["c1", "ci3"])
})

test("inviting someone who is already a collaborator does nothing and clears the field", () => {
  const { onAlbumUpdate } = setup([
    album({ id: "a", name: "A", collaborationEnabled: true, collaborators: [person("c1", "Alex Roe")] }),
  ])
  const d = openFromCard("A", "Manage collaborators")
  const input = d.getByPlaceholderText("@username or name...") as HTMLInputElement
  fireEvent.change(input, { target: { value: "@ALEXROE" } })
  fireEvent.click(d.getByRole("button", { name: "Send invite" }))
  expect(onAlbumUpdate).not.toHaveBeenCalled()
  expect(input.value).toBe("")
})

test("the invite button is disabled for blank input, and Enter invites", () => {
  const { onAlbumUpdate } = setup([album({ id: "a", name: "A", collaborationEnabled: true })])
  const d = openFromCard("A", "Manage collaborators")
  const input = d.getByPlaceholderText("@username or name...")
  expect((d.getByRole("button", { name: "Send invite" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.keyDown(input, { key: "Enter" })
  expect(onAlbumUpdate).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: "Riley Kim" } })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(onAlbumUpdate).toHaveBeenCalledTimes(1)
})

test("clicking a role chip flips editor and viewer", () => {
  const a = album({
    id: "a",
    name: "A",
    collaborationEnabled: true,
    collaborators: [person("1", "Riley Kim", "viewer"), person("2", "Drew Hassan", "editor")],
  })
  const { onAlbumUpdate } = setup([a])
  const d = openFromCard("A", "Manage collaborators")
  const chips = d.getAllByTitle("Click to toggle role")
  fireEvent.click(chips[0])
  expect(onAlbumUpdate.mock.lastCall![0].collaborators.map((c: Collaborator) => c.role)).toEqual(["editor", "editor"])
  fireEvent.click(chips[1])
  expect(onAlbumUpdate.mock.lastCall![0].collaborators.map((c: Collaborator) => c.role)).toEqual(["viewer", "viewer"])
})

test("removing a collaborator drops only that person", () => {
  const a = album({
    id: "a",
    name: "A",
    collaborationEnabled: true,
    collaborators: [person("1", "Riley Kim"), person("2", "Drew Hassan")],
  })
  const { onAlbumUpdate } = setup([a])
  fireEvent.click(openFromCard("A", "Manage collaborators").getByRole("button", { name: "Remove Riley Kim" }))
  expect(onAlbumUpdate).toHaveBeenCalledExactlyOnceWith({ ...a, collaborators: [a.collaborators[1]] })
})

// Collaboration on the card

test("card shows collaborator count, or 'Collaboration on' when nobody is invited", () => {
  setup([
    album({ id: "a", name: "Solo", collaborationEnabled: true }),
    album({ id: "b", name: "One", collaborationEnabled: true, collaborators: [person("1", "Riley Kim")] }),
    album({
      id: "c",
      name: "Many",
      collaborationEnabled: true,
      collaborators: [person("1", "Riley Kim"), person("2", "Drew Hassan")],
    }),
    album({ id: "d", name: "Off", collaborationEnabled: false, collaborators: [person("1", "Riley Kim")] }),
  ])
  expect(within(card("Solo")).getByText("Collaboration on")).toBeTruthy()
  expect(within(card("One")).getByText("1 collaborator")).toBeTruthy()
  expect(within(card("Many")).getByText("2 collaborators")).toBeTruthy()
  expect(card("Off").querySelector(".am-card-meta")).toBeNull()
})

test("card shows at most three avatars plus a +N overflow", () => {
  const people = ["1", "2", "3", "4", "5"].map((id) => person(id, `Person ${id}`))
  setup([album({ id: "a", name: "A", collaborationEnabled: true, collaborators: people })])
  const avatars = card("A").querySelectorAll("img.am-avatar")
  expect([...avatars].map((el) => el.getAttribute("alt"))).toEqual(["Person 1", "Person 2", "Person 3"])
  expect(within(card("A")).getByText("+2")).toBeTruthy()
})

test("no overflow badge for three or fewer collaborators", () => {
  const people = ["1", "2", "3"].map((id) => person(id, `Person ${id}`))
  setup([album({ id: "a", name: "A", collaborationEnabled: true, collaborators: people })])
  expect(card("A").querySelectorAll("img.am-avatar")).toHaveLength(3)
  expect(card("A").querySelector(".am-avatar-more")).toBeNull()
})

test("avatars are hidden when collaboration is turned off", () => {
  setup([album({ id: "a", name: "A", collaborationEnabled: false, collaborators: [person("1", "Riley Kim")] })])
  expect(card("A").querySelector(".am-avatars")).toBeNull()
})

test("avatar tooltip shows name and role", () => {
  setup([
    album({ id: "a", name: "A", collaborationEnabled: true, collaborators: [person("1", "Drew Hassan", "editor")] }),
  ])
  expect(within(card("A")).getByTitle("Drew Hassan (editor)")).toBeTruthy()
})
