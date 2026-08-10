# Fashion Prompt Builder

A local-first Next.js application that analyzes fashion reference images with the Gemini Developer API and returns one Master Reference Prompt plus exactly five distinct Keyframe Prompts.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, add your own Gemini API key, then upload a model reference and at least one product/outfit reference.

## Privacy and storage

- The Gemini API key is stored only in browser `localStorage` under `fashion-prompt-builder:gemini-api-key`.
- Prompt history and selected image blobs are stored locally in IndexedDB.
- Images are sent directly from the browser to Gemini only when generating prompts.
- History export never includes an API key (export is not part of the current MVP UI).
- There is no application backend, account system, cloud database, or API-key proxy.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

The production build is configured as a static export in `out/`.
# prompt-_video_aff_ai
