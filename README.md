# STSWENG SMART ALBUM 

## Project Setup Guide

## Prerequisites

Before running the project, install the following:

- [Node.js (LTS)](https://nodejs.org/en/download)
- [Git](https://git-scm.com/downloads)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)

Verify that Node.js, npm, and Git are installed:

```bash
node -v
npm -v
git --version
```

## 1. Clone the Repository

Clone the repository from GitHub:

```bash
git clone https://github.com/rachell-code/STSWENG_SmartAlbum.git 
```

Navigate to the project directory:

```bash
cd STSWENG_SmartAlbum
```

## 2. Install Frontend Dependencies

Navigate to the frontend directory:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

## 3. Run the Frontend 

In the frontend terminal, run:

```bash
npm run dev
```

The frontend should start at:

http://localhost:5173/

## 4. Run the album API

The album list needs the API. In a second terminal, from the project root:

```bash
cd server
npm start
```

The API listens at http://localhost:3000. `npm run dev` proxies `/api` to it.

Sign in with demo administrator `test` / `tester123`. Users are loaded from
`server/data/users.json`; passwords are scrypt hashes, not plaintext. Sessions are HTTP-only
cookies, expire after 8 hours, and are revoked by logout or an API restart. Only administrators
create and label albums. All album/photo/collage access is scoped to the authenticated account.

The seed account is for demonstrations only: change its credentials before public deployment.
There is no registration or user-management UI. Provision users manually with a unique `id`,
`username`, `role` (`admin` or `user`), a random 16-byte hexadecimal `salt`, and a 64-byte
hexadecimal `passwordHash` produced by Node's `scrypt(password, salt, 64)` defaults.
Existing plaintext user files must be migrated before starting this version; invalid files fail closed.

Local dev/preview use the loopback API proxy. For separate HTTPS hosts, build with `VITE_API_URL`
pointing to the API and allow third-party cookies; HTTPS is required for cross-site sessions.
The API allows the existing deployed frontend origin and loopback HTTP origins. Prefer a same-origin
reverse proxy if the browser blocks third-party cookies. Forward `X-Forwarded-Proto: https` only
from a trusted proxy. Sessions and rate limits are process-local; use one API instance until a
shared session store is added. Album stores remain JSON files, not crash-atomic multi-file transactions.

## 5. Run checks

Use Node 22. In `frontend/`, run `npm test`, `npm run lint` and `npm run build`.
In `server/`, run `npm test`.

For the browser gate, install Python 3.12+ and Chrome, then run from the project root:

```bash
npm ci --prefix frontend
python -m pip install -r tests/requirements.txt
node --experimental-strip-types tests/run-browser.mjs
```

The harness starts its own disposable API and built frontend on loopback ports. It forces the
local API even if `.env` names a deployed server; no development server or seeded data is used.
It runs 13 headless Chrome tests and checks persisted image bytes. Temporary stores are removed
on exit. Selenium Manager downloads a matching driver when needed (network access required).

For a virtual environment, pass its Python executable as the first argument to the Node command,
or set `ROBOT_PYTHON`. `ROBOT_BROWSER=chrome` runs headed Chrome instead of headless Chrome.
Reports, screenshots and `api.log` are written to ignored `tests/results/`; CI uploads these
as `robot-browser-results` for seven days. Browser tests are destructive only to their temporary
data: do not point the suites at a deployed app or your regular development data.

Coverage includes album creation/details, JPG/PNG/GIF/WebP uploads, mixed-validity selection,
size rejection, queue removal, refresh persistence, saved order, copied-photo collages,
grid/single membership removal, album deletion preserving library files, and session/logout.
The checked-in fixtures and ZIP are retained; the WebP file is named `sample.WEBP`.

# STSWENG_PhotoAlbumManager
