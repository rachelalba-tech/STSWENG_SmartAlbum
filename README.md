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

# STSWENG_PhotoAlbumManager
