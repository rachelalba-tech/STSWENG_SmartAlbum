# US11 — Exact duplicate photo detection

## Independent feature files
- `server/src/duplicate-detection.ts`: SHA-256 byte-level duplicate grouping.
- `server/test/duplicate-detection.test.ts`: isolated test.

## Integration
Import `findExactDuplicateGroups` into the authenticated photo-analysis route. Pass only photos owned by the signed-in user and, when scanning an album, only that album's membership records. Convert returned records to public photo DTOs before sending them to the client. Keep deletion separate from detection: ask for confirmation, then delete only IDs returned by `redundantDuplicateIds`, preserving the first photo in each group. For album-scoped scans, detach from that album rather than deleting the library file.

This detects exact file duplicates only; visually similar images are intentionally not considered duplicates.

## Test
`node --experimental-strip-types --test server/test/duplicate-detection.test.ts`
