# PokéTrack TCG — Serverless Pokémon Card Collection Tracker

A sleek Pokémon Trading Card Game collection tracker that runs **100% serverless via GitHub Pages**, saving all your card collection data directly to [`collection.json`](./collection.json) in your GitHub repository via the GitHub REST API.

---

## 🚀 Key Features

* **100% Static & Serverless**: Hosted entirely on GitHub Pages — no backend server, no database, zero cost.
* **Persistent GitHub Sync**: Uses the GitHub REST API to read and commit your collection directly to `collection.json` in your repository.
* **Multi-Device Support**: Access your collection on your phone, tablet, or desktop with synchronized data across devices.
* **Instant Local Caching**: Changes save immediately to browser `localStorage` with debounced background commits to GitHub for zero UI latency.
* **Resilient Offline Fallback**: Bundles seed sets and cards to ensure the app continues to work smoothly even if third-party APIs experience downtime.
* **Text & JSON Backups**: One-click download and upload of `.json` and `.txt` collection backup files.

---

## 🔑 How to Set Up GitHub Cloud Sync

1. Open the application on GitHub Pages.
2. Click the **"Cloud Sync"** button in the top navigation bar.
3. Verify your **GitHub Username** (`BradleyLauweres`) and **Repository Name** (`PokemonCardCollection`).
4. Generate a GitHub Personal Access Token (PAT):
   * [Click here to create a Fine-Grained Token](https://github.com/settings/tokens?type=beta) with:
     * **Repository Access**: Only select `PokemonCardCollection`
     * **Permissions**: `Contents: Read and write`
   * *Or* [Click here to create a Classic Token](https://github.com/settings/tokens/new?scopes=repo&description=PokeTrack+TCG+Sync) with the `repo` scope selected.
5. Paste the token into the **Personal Access Token** field.
6. Click **"Test Connection"** to verify access, then click **"Save Settings"**.

> 🔒 **Privacy & Security**: Your token is stored **solely in your browser's local storage** (`localStorage`). It is never sent to any backend server and communicates directly with `https://api.github.com`.

---

## 🛠️ Development & Deployment

### Local Development

```bash
cd frontend
npm install
npm run dev
```

### Build for Production

```bash
cd frontend
npm run build
```

### Deploy to GitHub Pages

```bash
cd frontend
npm run deploy
```

This runs `vite build` and deploys the contents of `dist/` directly to your repository's `gh-pages` branch.
