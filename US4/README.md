# US#4 — Reorder Album Photos (code-only package)

This archive contains only the Reorder Photos feature snippets. It does NOT contain the main branch or a complete project.

## Apply these snippets
- `frontend/AlbumPage.reorder.snippet.tsx`: add the ordering state/handlers and reorder UI inside the album page component. The component needs `photos` and `onReorder` props.
- `frontend/api.reorderPhotos.snippet.ts`: add the API helper to `frontend/src/app/api.ts`.
- `frontend/App.reorder-integration.snippet.tsx`: add `handleReorder` and pass `onReorder` to `AlbumPage`; import `reorderAlbumPhotos`.
- `backend/http.reorderPhotos-route.snippet.ts`: add the PUT handler inside `createAlbumServer`.
- `backend/photo-order-support.snippet.ts`: add `position` to the photo type, sort album photos by position, and allow it in stored-photo validation.

The `AlbumPage` stylesheet is an existing presentation dependency; use the CSS already supplied in the integrated version or style these controls in your project's existing stylesheet. These are snippets, not a standalone project.
