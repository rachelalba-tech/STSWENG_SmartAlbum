# US#2 — Delete Album (code-only package)

This archive contains only the Delete Album feature snippets. It does NOT contain the main branch or a complete project.

## Apply these snippets
- `frontend/AlbumManager.delete.snippet.tsx`: add the delete control inside each album card. `AlbumManager` props need `onAlbumDelete: (albumId: string) => Promise<void>`.
- `frontend/api.deleteAlbum.snippet.ts`: add the API helper to `frontend/src/app/api.ts`.
- `frontend/App.deleteAlbum-integration.snippet.tsx`: add the callback to `AlbumManager` in `AlbumListRoute`; ensure `deleteAlbum` is imported.
- `backend/http.deleteAlbum-route.snippet.ts`: add inside `createAlbumServer`; requires `saveAlbums`, `photoStorage`, `ownerId`, and album array. It preserves photos in the library by clearing their album association.
- `backend/persistence.snippet.ts`: shows album persistence wiring required by the route.

These are integration snippets, not standalone source files. Merge them into the matching files in your own branch; do not replace project files wholesale.
