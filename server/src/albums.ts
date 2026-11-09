export type Album = {
  id: string
  title: string
  ownerId: string
}

export function listAlbumsForUser(albums: Album[], ownerId: string): Album[] {
  return albums.filter((album) => album.ownerId === ownerId)
}

export function openAlbum(albums: Album[], ownerId: string, id: string): Album | undefined {
  return albums.find((album) => album.id === id && album.ownerId === ownerId)
}
