# US25 backend route contract

This story uses the existing authenticated routes in the SmartAlbum server:

- `POST /api/albums/:albumId/photos` — upload a new image into an album.
- `PUT /api/albums/:albumId/photos` — add existing library photo IDs to an album without moving them out of other albums.
- `DELETE /api/albums/:albumId/photos/:photoId` — remove album membership only.
- `PATCH /api/photos/:photoId` — update title/caption.
- `DELETE /api/photos/:photoId` — permanently delete the photo and its file from the user's library.

All routes must derive the owner from the authenticated session, never from request data. The server must validate that the target album and photo belong to that owner. Keep album removal distinct from permanent library deletion.

**Sharing limitation:** the current project implementation only creates/opens an app album URL; it does not implement an access-controlled invitation, recipient selection, or share-permission record. Do not describe that URL as sharing with another user. A real user-to-user share feature needs a share table/store, recipient authorization, and an authenticated shared-album read route.
