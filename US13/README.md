# US13 — Low-quality photo detection

## Independent feature files
- `server/src/photo-quality.ts`: dimensions and file-size warnings.
- `frontend/src/visual-quality.ts`: browser-side blur/sharpness and exposure heuristics.
- `server/test/photo-quality.test.ts`: focused test.

## Integration
Use `assessFileQuality` in the authenticated scan endpoint for each photo owned by the current user (and filter by album membership when an album is selected). Return photo ID, dimensions, and reasons. In the gallery, call `inspectVisualQuality(photo.src)` and merge its warnings into the matching photo's findings. Present results as warnings for manual review, not automatic proof that an image is bad. If an image is cross-origin and canvas pixel access is blocked, the browser heuristic returns no visual warning; server-side dimensions/file-size checks still work.

## Test
`node --experimental-strip-types --test server/test/photo-quality.test.ts`
