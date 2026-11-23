# Agent Context — STSWENG Smart Album

Start here. Several people work on this repo, each with their own tools and agent setup, so this file
holds only repo-wide facts and rules. Machine paths, personal tools and delegation workflows belong in
your own user-level config, not here.

## Files in `.agents/`

| File          | What it is                                                                                    | Who edits it |
| ------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `AGENTS.md`   | This file: current state, commands, rules                                                      | Agents and people |
| `PROPOSAL.md` | Project specs, methodology, Git workflow, CI, commit and PR rules. **The source of truth.**   | **READ-ONLY.** Never edit it. |
| `PRODUCT_BACKLOG.md` | Product backlog (user stories US #1–#26, priorities, assignees, tasks). There is no `TODO.md`. | People; agents update status only (see below) |
| `HISTORY.md`  | Log of meaningful changes, newest first                                                        | Agents and people |
| `PLAN.md`     | *Optional, gitignored, one per lab.* Your own implementation and handoff notes (see below)    | You only |

If this file and `PROPOSAL.md` disagree, `PROPOSAL.md` wins, except for the explicitly authorized
documentation-only workflow exception under *Rules*. Otherwise, fix this file to match.

**`PLAN.md` (per-lab handoff):** you can keep your own `.agents/PLAN.md` holding the current task, the
decisions made, what is done and what comes next, written so that a fresh session with no earlier
context can pick up the work from it. Git ignores it, so every contributor's plan stays local. If you
have one, read it at the start of a session and update it before you stop. Anything that matters to
the whole team belongs in `AGENTS.md` or `HISTORY.md` instead.

## Project

A web app for events. Users upload photos into albums that an admin creates. The app helps curate them:
it flags duplicate, similar and low-quality photos, recommends the best shots, organizes photos
chronologically from capture time and place in their metadata, lets users edit photos (crop, rotate,
color grade), arrange album/collage layouts, and preview and export the album. There are two roles:
**admin** (creates and labels albums) and **user** (uploads to them, edits and curates). See
`PROPOSAL.md` for the full spec and `PRODUCT_BACKLOG.md` for the stories.

Follow `PROPOSAL.md` when it and `PRODUCT_BACKLOG.md` conflict: only an admin creates and labels albums (US #1 is
written "as a user"). Do not renumber stories or reassign people; that is a team decision.

Planned parts (from `PROPOSAL.md`): web front end, back-end server, photo analysis module.

## Current state

<!-- Reconcile this section after every meaningful change. -->

- **Front end:** `frontend/`. Vite 8 + React 19 + TypeScript 6, ESLint, Vitest. Entry point is
  `src/main.tsx`; app code is in `src/app/` and styles in `src/styles/`. Hash routes: album list
  (`#/`), album page (`#/albums/:id`), upload (`#/upload`), and all-photos gallery (`#/photos`).
  The list is the album manager. Creating, renaming and deleting albums persist through the API
  (PR #23; US #1/#2/#8). Album deletion keeps image files in the library and removes saved collages.
  The album page supports editing its headline/description, adding library photos without moving
  them out of other albums, and drag/button reordering with an explicit save (US #4/#6/#8).
  The album page shows the title, a link back, and that
  album's photos, with a control to take a photo out of that album. Upload sends several JPG, PNG,
  GIF, or WebP files (10 MB each) to an album the API already has (US #9, Natt, PR #14). The gallery
  toggles a grid and a single photo, with arrow keys in single view (US #10, Alwayne, PR #15), and
  provides 90° counter-clockwise/clockwise rotation buttons in the top right of the single-view stage
  border with Save changes and Revert controls that persist rotated image bytes through the API (US #17).
- **Back end:** `server/src/`. Node.js HTTP (no framework or package dependencies) on port 3000,
  with TypeScript run directly by Node using `--experimental-strip-types`. At startup it validates
  and loads `server/data/albums.json` and `server/data/photos.json`, and creates
  `server/data/uploads/` if needed. `GET /api/albums` lists the current user's albums;
  `GET /api/albums/:id` returns an owned album or 404. `GET /api/photos` lists that user's photos;
  `GET /api/photos?albumId=` limits the list to one album. `POST /api/albums/:id/photos` stores an
  owned upload (raw body, image content-type, `x-file-name` header). `GET /api/uploads/:file`
  serves that user's file. `DELETE /api/albums/:albumId/photos/:photoId` clears that album link
  and leaves the file in the library (US #7, Joed). `PUT /api/photos/:id/image` replaces an owned
  photo's stored image file across all shared memberships, persists the update with rollback on save
  error, and cleans up the replaced file (US #17). Albums have `id`, `title`, `ownerId` and optional `description`.
  `POST /api/albums`, `PATCH /api/albums/:id` and `DELETE /api/albums/:id` persist album changes.
  Albums also have an optional `description`. `PATCH /api/albums/:id/photos` adds immutable-file
  memberships; `PATCH /api/albums/:id/photos/order` validates and saves an exact permutation.
  The library lists each physical file once; album lists sort by optional persisted `position`.
  Album cards and collage controls load each album's full membership list, including shared-file copies.
  Collages are persisted in `server/data/collages.json` through GET/POST/PUT/DELETE `/api/collages`.
  Saves use temporary files and atomic renames. Album deletion rolls back completed store writes
  on errors, but a process crash between JSON-file writes is not a database transaction.
- **Identity and remaining features:** runtime loads hashed users from `server/data/users.json`.
  `POST /api/login` validates scrypt hashes and issues an 8-hour HTTP-only session cookie;
  `GET /api/session` restores the server identity and `POST /api/logout` revokes it (PR #27; US #26).
  All data routes require a session and derive ownership from it, not client IDs/localStorage.
  Only admins create and label albums; the UI hides these controls for regular users.
  Sessions are process-local (restart signs everyone out), capped at 1000; login has bounded
  hashing concurrency and a 20-attempt/IP/minute limit. Cross-origin mutations are checked;
  allowed browsers are the deployed frontend and loopback HTTP. HTTPS cookies use SameSite=None
  and Secure, requiring third-party cookies on cross-site deployments; prefer a same-origin proxy.
  The checked-in `test` / `tester123` administrator is a demo, not production provisioning.
  Account registration/admin-user management and sharing are not implemented (US #24/#25). Photo cropping,
  color grading, export and photo analysis are not implemented. Template collages and saved-collage editing are
  implemented (PR #22; US #21). Collaboration and album cover selection remain page-local prototypes.
- **Tests:** frontend tests live in `frontend/test/`, outside `src/`. `frontend/vite.config.ts`
  discovers `test/**/*.test.{ts,tsx}` and runs them in jsdom. They cover static album rendering,
  hash parsing, upload selection and retry, and the gallery grid and single view. They do not call
  the API. The frontend build type-checks `src/` and `vite.config.ts`, not `test/`.
  `server/test/albums.test.ts` has seven tests covering ownership filtering, seed-file
  loading/validation and HTTP reads. `server/test/photos.test.ts` covers removing a photo from an
  album without deleting the file. `server/test/album-writes.test.ts` covers persistent album CRUD,
  membership/order validation, ownership and failed-save rollback. Frontend editing tests cover
  asynchronous save failures, details, adding photos and accessible reordering.
  Authentication tests cover hashed credentials, session rotation/expiry/logout, origin/rate limits,
  admin authorization, ownership isolation, forged localStorage, credentialed requests and gallery removal.
  The server test script discovers `test/*.test.ts`; there is no separate server type-check/build.
- **CI:** `.github/workflows/ci.yml` runs on pull requests and pushes to `main`, on Node 22. Frontend job:
  `npm ci`, `npm run lint`, `npm test`, `npm run build`.
  Server job: `npm test`. Browser job: Python 3.12, pinned Robot/Selenium dependencies,
  headless Chrome against a built frontend and disposable loopback API; reports, screenshots and
  API request logs are uploaded even on failure (PR #32). All three jobs run for every PR; there
  are no path filters or cancellation of outdated runs. Formatting,
  PR-title validation, automatic labeling, dependency updates and
  release automation are not configured in the repo. A GitHub ruleset on `main` blocks direct
  and force pushes for everyone and requires a PR with one approval from a reviewer with write access.
  Stale approvals are dismissed when the head or merge base changes; approval by someone other than
  the last pusher is not required by the live ruleset. This branch includes PR #24's shared lint fixes.
- **Formatter / end-to-end tests:** no formatter. `tests/` has 13 Robot/Selenium browser tests:
  creation/details, uploads/rejection/queue removal, saved order, library copies, collages,
  grid/single removal, non-destructive album deletion, session refresh and logout (PR #32).
  `tests/run-browser.mjs` builds with a forced local API, creates disposable JSON/upload stores,
  checks persisted photo bytes, and closes servers/removes its stores after success or failure.
  Original image fixtures and their ZIP remain unchanged; WebP fixture casing is `sample.WEBP`.
- **Album preview (US #22):** `#/albums/:id/preview`, linked from the album page, renders
  `src/app/AlbumPreview.tsx`: the album title and its photos (full images, API order) as a
  read-only page with no controls inside it. This preview does not render saved collage layouts; export
  (US #23) should render this same component. `frontend/test/albumPreview.test.tsx` covers it.

## Commands

Use the latest Node 22 release to match CI. Run the following in separate terminals, each starting
at the project root; there is no root package script.

```bash
cd frontend
npm install        # or `npm ci` for a clean, lockfile-exact install
npm run dev        # http://localhost:5173 — proxies /api to the server
```

```bash
cd server
npm start          # http://localhost:3000 — no npm install needed
```

Checks and local build preview (run in the named directory):

```bash
# frontend/
npm test           # vitest run — frontend/test/
npm run lint       # eslint .
npm run build      # tsc -b && vite build
npm run preview    # http://localhost:4173 — preview the built frontend

# server/
npm test           # node --experimental-strip-types --test test/*.test.ts
```

Vite preview [inherits `server.proxy`](https://vite.dev/config/preview-options#preview-proxy), so
both dev and preview forward `/api` to port 3000 and need the API running. The static build itself
does not include a proxy.

**Gate before a PR:** in `frontend/`, `npm test`, `npm run lint`, and `npm run build` must pass. In
`server/`, `npm test` must pass. From the root, browser suites must pass:

```bash
python -m pip install -r tests/requirements.txt
node --experimental-strip-types tests/run-browser.mjs
```

Requires Node 22, Python 3.12+ and installed Chrome; Selenium Manager supplies the driver.
Pass the Python executable as the harness's first argument (or `ROBOT_PYTHON`) for a virtual
environment. Use the harness, not a deployed API: it overrides `.env` API settings and uses
isolated stores. Results are in ignored `tests/results/`. When a formatter is added, add it here too.

## Rules (from `PROPOSAL.md`, with a documentation-only exception)

- **Code changes:** never commit or push directly to `main`. Work on a descriptively named branch,
  open a PR into `main`, and merge only after CI passes and a QA member or team lead approves.
- **Documentation-only exception:** context files (including `.agents/`) and other documentation
  may be committed and pushed directly to `main`; no separate branch or PR is required. This is an
  explicitly authorized exception to `PROPOSAL.md`'s branch/PR workflow. Changes that also affect
  code, tooling or CI follow the normal branch/PR workflow. The `main` ruleset currently rejects
  every direct push, so documentation also goes through a PR until the ruleset allows it.
- **Commit and PR titles** use `<type>(<optional scope>): <description>`, where type is one of
  `feat | fix | style | test | docs | refactor | chore`. Example: `feat(album): add drag-and-drop photo reordering`.
- **PRs stay small**, cover one task, and say what changed, why, and which user story (`US #n`) they address.
- Keep branches up to date with `main`. If you hit a merge conflict, resolve it and re-run the gate.
- Commit, push or open a PR only when the person you are working for asks you to.
- **Agents never credit themselves.** Do not add `Co-Authored-By:` trailers, "Generated with …" lines,
  or any other AI or agent attribution to commits, PR titles, PR descriptions or code. Commits are
  authored by the human contributor.

## Reference implementation: Immich

[Immich](https://github.com/immich-app/immich) is a mature self-hosted photo and video manager. Agents
may copy code from it roughly or take ideas from it. Clone it shallowly into the OS temp directory, not
into this repo:

```powershell
# PowerShell
git clone --depth 1 https://github.com/immich-app/immich.git "$env:TEMP\immich"
```
```bash
# bash / Git Bash
git clone --depth 1 https://github.com/immich-app/immich.git "${TMPDIR:-${TEMP:-/tmp}}/immich"
```

If the clone already exists, run `git -C <dir> pull` on it instead of cloning again.

Where to look:

| Need | Immich path |
| ---- | ----------- |
| Albums CRUD, adding and removing assets | `server/src/services/album.service.ts` |
| Upload and asset handling | `server/src/services/asset-media.service.ts`, `asset.service.ts` |
| EXIF / metadata extraction | `server/src/services/metadata.service.ts` |
| Thumbnails and transcoding | `server/src/services/media.service.ts` |
| Duplicate and similar detection (CLIP embeddings) | `server/src/services/duplicate.service.ts`, `smart-info.service.ts`, `machine-learning/immich_ml/models/clip/` |
| Auth, users, admin role | `server/src/services/auth.service.ts`, `user.service.ts`, `user-admin.service.ts` |
| Album page, timeline, photo viewer UI | `web/src/lib/components/{album-page,timeline,asset-viewer}/` |

Notes:

- Immich's server is NestJS (TypeScript), its web app is **Svelte**, and its ML service is Python
  (FastAPI). Our front end is React, so treat Immich's UI code as a reference for logic and behavior,
  not something to paste.
- Immich is licensed **AGPL-3.0**. When you copy a non-trivial piece, add a comment naming the source
  path, e.g. `// adapted from immich server/src/services/album.service.ts`.

## Keeping context current (last step of every meaningful change)

Before you finish any change that affects behavior, structure, tooling, CI or dependencies:

1. **`AGENTS.md`**: update *Current state*, *Commands* and the gate so they match the repo.
2. **`HISTORY.md`**: add an entry at the top: date, branch, a one-line summary, and the user story if
   there is one.
3. **`PRODUCT_BACKLOG.md`**: if the change finishes a backlog task, mark it done. Do not invent stories, renumber
   them or reassign people. Those are team decisions.
4. Remove anything in these files that is no longer true.

Typo fixes and other trivial edits need none of this.
