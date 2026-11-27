# US25 — Photo management

## Independent feature files
- `frontend/src/photo-management-api.ts`: upload, add-existing, detach, permanent-delete, and edit API helpers.
- `frontend/src/PhotoManagementActions.tsx`: isolated album-removal/permanent-delete actions.
- `server/ROUTE_CONTRACT.md`: exact backend route and authorization contract.
- `server/test/management-contract.test.mjs`: verifies the two deletion scopes remain distinct.

## Integration
Import the API helpers into the album/gallery pages. Use `uploadToAlbum` for new uploads, `addExistingPhotos` for selecting library photos, `detachFromAlbum` when removing only from an album, `permanentlyDeletePhoto` for full library deletion, and `editPhotoDetails` for title/caption changes. Refresh the gallery/album after successful mutations. Use the server route contract to verify owner checks and persistence.

## Important sharing status
The existing project code does **not** provide true user-to-user sharing. An app URL is not an invitation and does not grant another account access. The missing permissioned sharing work is documented in `server/ROUTE_CONTRACT.md`; it must not be marked complete until recipient-based authorization is implemented and tested.

## Test
`node --test server/test/management-contract.test.mjs`
