# History

This file logs meaningful changes, with the newest entry first. Each entry follows this format:
`YYYY-MM-DD · branch · type(scope): summary (US #n)`.

- 2026-11-27 · feat/similar-pictures · feat(photos): flag low-quality photos in gallery and albums with warning badges, grid/one-by-one review, keep choices, and individual or confirmed bulk album/library deletion; remove quality rating display from similar photos (US #13).
- 2026-11-27 · feat/similar-pictures · feat(photos): identify visually similar photo sets in gallery and albums with per-set review and scoped album/library deletion (`DELETE /api/photos/:photoId`) (US #12).
- 2026-11-27 · feature/workflow · chore(ci): deploy the tested main commit to Render staging, gate production on environment approval, and allow the staging frontend origin (PR #39).
- 2026-11-27 · feat/ui · feat(ui): refresh branding, consolidate styles and group album actions without dropping upload, rotation, or collage behavior (PR #35).
- 2026-11-27 · feat/rotate-photo · feat(photos): persist 90° single-view rotation with stale-edit and animation guards (PR #34; US #17).
- 2026-11-24 · main (uncommitted) · feat(upload): allow uploading photos directly to the Photos library (`POST /api/photos`) without selecting an existing album (US #9).
- 2026-11-23 · feat/joed-collage-export · chore(pr): sync saved collage preview/export with merged album CRUD, session auth and browser CI (US #22/#23).
- 2026-11-23 · feat/joed-duplicate-photos · chore(pr): sync exact duplicate cleanup with merged album CRUD, session auth and browser CI (US #11).
- 2026-11-23 · feat/joed-best-photos · chore(pr): sync photo recommendations with merged album CRUD, session auth and browser CI (US #14).
- 2026-11-23 · docs/backlog-completion-audit · docs(backlog): reconcile backlog audit with merged PRs #23, #27 and #32.
- 2026-11-19 · test/upload-photo · docs(ci): correct live review rules; stale head/merge-base approvals are dismissed, but last-pusher approval is permitted.

- 2026-11-19 · test/upload-photo · test(browser): repair and extend Robot suites; add isolated local API/build harness, persistence checks and CI browser evidence (PR #32; US #1/#2/#3/#4/#6/#7/#8/#9/#10/#21/#26). All 13 Chrome tests pass locally.

- 2026-11-19 · feat/login · fix(auth): replace plaintext/UI-only login with hashed credentials, expiring HTTP-only sessions, session ownership and admin authorization; retain collages and grid/single album removal (PR #27; US #26/#10).
- 2026-11-19 · John/-US-backend-of-1-2-4-8 · fix(album): load full memberships for album cards and collages instead of deduplicated library entries (PR #23; US #6/#21).

- 2026-11-19 · John/-US-backend-of-1-2-4-8 · fix(album): integrate persistent album CRUD, details, shared-file memberships and saved photo order; preserve library bytes and test ownership/rollback (PR #23; US #1/#2/#4/#6/#8).

- 2026-11-13 · feat/joed-collage-export · feat(album): preview saved collage layouts and download matching PNG/JPEG images with geometry, transparency, missing-photo and image-failure safety; correct invalid template cells without changing saved IDs/order (Joed; US #22/#23).
- 2026-11-13 · feat/joed-duplicate-photos · feat(photos): review exact duplicates and remove explicit selections with ownership, membership, persistence and shared-file safety; compose with recommendation memberships (Joed; US #11).
- 2026-11-13 · feat/joed-best-photos · feat(photos): recommend clear photos with bounded pixel analysis and add them to existing owned albums without moving source memberships; resolve API image URLs (Joed; US #14).
- 2026-11-13 · docs/backlog-completion-audit · docs(backlog): audit all 26 stories against merged code; record partial US #21 layout geometry and upload/deployment gaps, correct US #22 to partial, and record pending PRs without changing assignees. No fully completed unassigned stories found.
- 2026-11-12 · fix/frontend-lint · fix(frontend): clear the four lint errors so the new CI lint step passes on `main`.
- 2026-11-12 · fix/collage-api-origin · fix(api): send collage requests to `API_URL` and allow PUT, DELETE and `X-File-Name` in CORS so collages and uploads work against the deployed API.
- 2026-11-05 · feat/album-preview · feat(album): read-only album preview before export; mark done stories (US #3, #9, #10, #22) in the backlog (Joed; US #22).
- 2026-10-31 · main · feat(photos): add the all-photo grid and expanded arrow-key photo viewer (US #10).
- 2026-10-31 · main · chore(make): bootstrap the API and frontend together and configure verified frontend-only deployment.
- 2026-11-05 · ElisaP16-product_backlog · docs(backlog): sync the sprint 2 backlog with the team's GDocs and renumber US #14–#26 so US #15 is no longer used twice (PR #18, Elisa).
- 2026-10-31 · feat/photo-view · feat(photos): add the all-photo grid and single-photo viewer (PR #15, Alwayne; US #10).
- 2026-10-31 · feat/photo-upload · feat(photos): upload photos into an existing album (PR #14, Natt; US #9).
- 2026-10-29 · main · docs(agents): reconcile source/test paths, demo-user scope, commands and CI coverage; record the documentation-only direct-to-main workflow exception.
- 2026-10-28 · chore/workflow · chore(test): move frontend tests from `src/app/` to `test/` and configure Vitest discovery (commit `a3418ba`, PR #9; US #3).
- 2026-10-28 · feat/view-albums · feat(album): list and open the demo user's albums; login remains pending (US #3).
- 2026-10-28 · feat/view-albums · docs(agents): reconcile current state with the reorganized frontend and the proposal.
- 2026-10-26 · docs/agents-context · docs(agents): set up `.agents/` context. Added `AGENTS.md` and
  this file, root `AGENTS.md` and `CLAUDE.md` pointers to them, a gitignored per-lab `PLAN.md`
  handoff file, and a rule that agents never credit themselves.
