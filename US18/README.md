# US18 — Individual photo title and caption editing

## Independent feature files
- `frontend/src/PhotoDetailsEditor.tsx`: isolated edit form.
- `frontend/src/photo-details-api.ts`: authenticated PATCH helper.
- `server/src/photo-details.ts`: strict patch validation.
- `server/test/photo-details.test.ts`: focused test.

## Integration
Render `PhotoDetailsEditor` for the selected photo. Pass `savePhotoDetails` (or adapt the helper to the app's existing `apiFetch`) as its `onSave`. In the authenticated `PATCH /api/photos/:id` handler, validate the request body with `parsePhotoDetailsPatch`, find the photo by both ID and authenticated owner ID, apply the returned patch, persist the photo store, and return the updated public photo. Display `description` as the caption in both grid and single-photo views. The existing app uses `description` as the caption field.

## Test
`node --experimental-strip-types --test server/test/photo-details.test.ts`
