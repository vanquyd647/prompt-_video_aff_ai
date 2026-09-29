# Fashion Prompt Builder

A local-first Next.js application that analyzes fashion references with Gemini. The home page uses `gemini-3.5-flash-lite` to write an English Character Turnaround Sheet prompt for exactly five ordered views: FRONT, 3/4 FRONT, STRICT SIDE, BACK, 3/4 BACK in one landscape 16:9 image. It returns text, not an image. Prompts can be edited, copied, downloaded as `.txt` and stored with reference images in IndexedDB. Previously generated images remain readable in the same history; generating again always uses the text model.

The original four-panel prompt builder and its history remain available at `/prompt-history`. `/outfit-3d` creates mannequin outfit prompts with product category assignments.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, add your own Gemini API key, then upload a model reference, at least one product/outfit reference, and a background reference. Use a full-body model photo to preserve body proportions; enter actual measurements in notes if known. The prompts lock the model's observed body, exact product details, and supplied background across all four panels without reshaping, redesigning, or substituting the scene.

On `/video-prompt`, choose **Một ảnh pose** to animate an individual front, back, three-quarter, or slay image without an end frame. Crop a panel from the 2×2 composite before uploading it. This mode requests one continuous sharp shot with no transition. Choose **Ảnh đầu + cuối** to bridge two reference poses with one short soft blur. Both modes preserve the model, body, product and background and prohibit dialogue, voice-over and lip-sync.

Video generation analyzes the model, outfit details, poses, scene and motion constraints, then selects one eligible scenario from `fitcheck_prompts.txt`. The result shows the original scenario, reason and adaptation alongside the final prompt. Flash, light-sweep and wipe effects are excluded by continuity rules; camera-driven scenarios are also excluded from single-image mode's fixed-camera workflow.

### Video concept keywords

Video Prompt also uses the v2.0.0 keyword library from `E:\Quy\AI PRODUCT CONCEPT & PROMPT BUILDE\keyword_app_data_v1(1).json`. The complete 161-key snapshot is vendored in `src/lib/prompts/product-keywords.source.json`; builds do not depend on that external folder. Meanings, English prompt hints, canonical keys and aliases are preserved from the source. No environment files or credentials are imported.

Select one concept and up to three modifiers, or leave the selection empty for Gemini to choose from the compatible catalog. Search accepts Vietnamese meanings, slash keys and source aliases (for example `fit check` or `slow motion`). The result reports the canonical keys and how each was applied. Unknown keys, missing requested keys and incompatible combinations are rejected.

`src/lib/prompts/video-keywords.ts` filters video/general/fashion entries and applies this app's reference locks: single-image mode keeps a fixed camera; two-image mode uses only the existing soft-blur bridge. The picker explains unavailable entries. Styling/try-on/GRWM operate on the existing outfit; lookbook stays within one short shot; neither changes identity, garments, scene or lighting. Update the vendored snapshot deliberately when the source library changes and rerun the tests.

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
