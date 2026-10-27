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

Login is not built yet. The API uses a demo user and reads albums from `server/data/albums.json`.

# STSWENG_PhotoAlbumManager
