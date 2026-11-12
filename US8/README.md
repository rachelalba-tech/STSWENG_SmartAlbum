# US#8 — Album Headlines and Descriptions (code-only package)

This archive contains only the Album Headline/Description feature snippets. It does NOT contain the main branch or a complete project.

## Apply these snippets
- `frontend/AlbumPage.details.snippet.tsx`: add editing state/handler and the headline/description editor UI inside the album page. Requires `onAlbumUpdate`.
- `frontend/api.updateAlbum.snippet.ts`: add the API helper to `frontend/src/app/api.ts`.
- `frontend/App.updateAlbum-integration.snippet.tsx`: add `handleAlbumUpdate` and pass `onAlbumUpdate` to `AlbumPage`; import `updateAlbum`.
- `backend/http.updateAlbum-route.snippet.ts`: add the PATCH handler inside `createAlbumServer`.
- `backend/album-description-persistence.snippet.ts`: ensure `Album` supports optional `description`, validate it when loading, and persist album updates with `saveAlbums`.

These are integration snippets, not standalone source files. Merge them into the matching files in your own branch.
