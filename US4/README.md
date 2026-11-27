# US4 — Drag-and-drop album photo ordering

This folder contains only US4 feature snippets and its focused order-validation test. It does not include the application.

## Feature scope
- Drag photos into a preferred order in an album.
- Save the order through the album photo-order API.
- Reject incomplete, duplicate, or foreign photo IDs on the server.

## Integration
Apply the frontend snippets to the existing AlbumPage, API module, and App integration points as described in `CONTENTS.txt`. Apply the backend route and position-support snippets inside the existing server. Preserve unrelated routes and handlers. The backend must persist the `position` field and return photos sorted by it.

## Test
`node --test tests/reorder.test.mjs`

This package is a feature patch/snippet set, not a standalone application.
