# Studio image generator (dev-only)

This folder contains a **dev-only** script that generates 2D “studio” images (single plant, side view, white background) from the raw photos in `images/`.

## Setup (Windows)

1. Ensure your repo root `.env` contains:
   - `GOOG_API_KEY=...`

2. Create a virtualenv and install deps:

```bash
cd pa-wildflower-selector
python -m venv .venv
.venv\Scripts\activate
pip install -r scripts/studio_images/requirements.txt
```

## Run

Generate studio images into `images/studio_full` (skips ones already present):

```bash
python scripts/studio_images/generate_studio_images.py --input-dir images --output-dir images/studio_full
```

Higher quality (still fast model) tips:

- Preserve model output format (often PNG) to avoid extra compression:

```bash
python scripts/studio_images/generate_studio_images.py --output-format keep
```

- If using WebP, bump quality (bigger files):

```bash
python scripts/studio_images/generate_studio_images.py --webp-quality 96
```

By default, outputs are written as **`.webp`** (smaller + modern for web). You can change this:

```bash
python scripts/studio_images/generate_studio_images.py --output-format jpg
```

Dry-run (no API calls, no writes):

```bash
python scripts/studio_images/generate_studio_images.py --dry-run --limit 10
```

Use a custom prompt without editing the script:

```bash
python scripts/studio_images/generate_studio_images.py --prompt-file scripts/studio_images/prompt.txt
```

## Cropping (reduce whitespace)

By default the script **auto-crops** the generated image by trimming near-white margins, then adds a small padding.

- Disable: `--no-autocrop`
- Crop algorithm: `--crop-mode bg-diff` (default) or `--crop-mode near-white`
- Tune aggressiveness:
  - `--crop-mode bg-diff`: `--crop-threshold 8` (tighter) or `--crop-threshold 16` (looser)
  - `--crop-mode near-white`: `--crop-threshold 245` (looser) or `--crop-threshold 252` (tighter)
- Tune padding: `--crop-padding 12`

Example:

```bash
python scripts/studio_images/generate_studio_images.py --overwrite --crop-threshold 252 --crop-padding 12
```

## Notes

- Inputs: `*.jpg`, `*.jpeg`, `*.png` in `images/`.
- Skips: `*.preview.jpg` (unless you pass `--no-skip-preview`) and anything already generated in `images/studio_full/`.
- Output format defaults to `.webp`. Use `--output-format keep` to preserve the model output type.

