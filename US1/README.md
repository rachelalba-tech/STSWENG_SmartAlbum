# US#1 — Create Album (code-only feature package)

Contains only Create Album feature code snippets; no full project or main-branch snapshot.

## Integration
1. Add `backend/readJson.helper.snippet.ts` once to `server/src/http.ts` at module scope. The base project already has `readBody`; do not duplicate it.
2. Add `backend/http.createAlbum-route.snippet.ts` inside `createAlbumServer` before the GET routes. Ensure imports for `randomUUID` and `Album` exist.
3. Apply `backend/persistence.snippet.ts`: merge the imports into the existing `server/src/store.ts` import, add the complete `saveAlbums` helper, import it in `server/src/server.ts`, and pass `saveAlbums` to `createAlbumServer`. Do not duplicate an existing helper.
4. Add `frontend/api.createAlbum.snippet.ts` to `frontend/src/app/api.ts`.
5. Integrate `frontend/AlbumManager.create.snippet.tsx` into the existing `AlbumManager` component and `frontend/App.createAlbum-integration.snippet.tsx` into `AlbumListRoute`.

The feature creates an empty album with a required trimmed title and optional description. The server assigns the current user as owner and persists the album.
