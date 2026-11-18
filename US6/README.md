# US#6 — Add Photos to Album (code-only package)

This archive contains only the Add Photos feature snippets. It does NOT contain the main branch or a complete project.

## Apply these snippets
- `frontend/AlbumPage.addPhotos.snippet.tsx`: add selection state/handler and the library-picker UI inside the album page. It needs `libraryPhotos` and `onAddPhotos` props.
- `frontend/api.addPhotos.snippet.ts`: add the API helper to `frontend/src/app/api.ts`.
- `frontend/App.addPhotos-integration.snippet.tsx`: load the full photo library in `AlbumRoute`, add `handleAddPhotos`, and pass `libraryPhotos`/`onAddPhotos` to `AlbumPage`.
- `backend/http.addPhotos-route.snippet.ts`: add the PATCH handler inside `createAlbumServer`. It moves selected photo membership to the requested album; it does not create shared membership.

These are integration snippets, not standalone source files. Merge them into the matching files in your own branch.
