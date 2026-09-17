# Fashion Prompt Builder

A local-first Next.js application that analyzes fashion reference images with the Gemini Developer API and returns one Master Reference Prompt plus exactly four panel prompts: fixed front and back, then two distinct poses selected from `fitcheck_pose_list.txt`. Leave pose 3/4 on automatic for AI selection after reference analysis, or choose them manually. The prompts describe a single portrait 9:16 image with a borderless, gapless 2×2 grid; each panel is also 9:16. The selected IDs and reasons are retained in history and when restoring/regenerating prompts.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, add your own Gemini API key, then upload a model reference, at least one product/outfit reference, and a background reference. Use a full-body model photo to preserve body proportions; enter actual measurements in notes if known. The prompts lock the model's observed body, exact product details, and supplied background across all four panels without reshaping, redesigning, or substituting the scene.

On `/video-prompt`, choose **Một ảnh pose** to animate an individual front, back, three-quarter, or slay image without an end frame. Crop a panel from the 2×2 composite before uploading it. This mode requests one continuous sharp shot with no transition. Choose **Ảnh đầu + cuối** to bridge two reference poses with one short soft blur. Both modes preserve the model, body, product and background and prohibit dialogue, voice-over and lip-sync.

Video generation analyzes the model, outfit details, poses, scene and motion constraints, then selects one eligible scenario from `fitcheck_prompts.txt`. The result shows the original scenario, reason and adaptation alongside the final prompt. Flash, light-sweep and wipe effects are excluded by continuity rules; camera-driven scenarios are also excluded from single-image mode's fixed-camera workflow.

The two root `.txt` files are the catalog sources. Edit their numbered entries and run `npm run catalog` to refresh `src/lib/prompts/fitcheck-catalog.generated.json`. This also runs automatically before development/build. Keep existing IDs stable for saved history; IDs 1 and 19 identify front/back. Catalog text is data, never an instruction to override reference locks.

## Privacy and storage

- The Gemini API key is stored only in browser `localStorage` under `fashion-prompt-builder:gemini-api-key`.
- Prompt history and selected image blobs are stored locally in IndexedDB.
- Images are sent directly from the browser to Gemini only when generating prompts.
- History export never includes an API key (export is not part of the current MVP UI).
- There is no application backend, account system, cloud database, or API-key proxy.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The production build is configured as a static export in `out/`.
# prompt-_video_aff_ai
