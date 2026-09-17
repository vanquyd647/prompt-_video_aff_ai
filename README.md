# Fashion Prompt Builder

A local-first Next.js application that analyzes fashion reference images with the Gemini Developer API and returns one Master Reference Prompt plus exactly four panel prompts: front, back, front three-quarter, and slay. The prompts describe a single portrait 9:16 image with a borderless, gapless 2×2 grid; each panel is also 9:16.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, add your own Gemini API key, then upload a model reference, at least one product/outfit reference, and a background reference. Use a full-body model photo to preserve body proportions; enter actual measurements in notes if known. The prompts lock the model's observed body, exact product details, and supplied background across all four panels without reshaping, redesigning, or substituting the scene.

On `/video-prompt`, choose **Một ảnh pose** to animate an individual front, back, three-quarter, or slay image without an end frame. Crop a panel from the 2×2 composite before uploading it. This mode requests one continuous sharp shot with no transition. Choose **Ảnh đầu + cuối** to bridge two reference poses with one short soft blur. Both modes preserve the model, body, product and background and prohibit dialogue, voice-over and lip-sync.

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
