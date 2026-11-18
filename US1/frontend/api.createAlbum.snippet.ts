export async function createAlbum(title: string, description = ""): Promise<Album> {
  const res = await fetch("/api/albums", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, description }),
  })
  if (!res.ok) throw new Error("Could not create album")
  const body: unknown = await res.json()
  if (!isAlbum(body)) throw new Error("Could not create album")
  return body
}
