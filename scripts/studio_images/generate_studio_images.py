#!/usr/bin/env python3
"""
Generate 2D "studio" plant images (single plant, side view, white background)
from input photos using the Gemini API image generation model.

Dev-only utility: reads from ./images and writes to ./images/studio_full by default.
"""

from __future__ import annotations

import argparse
import base64
import mimetypes
import os
import random
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import statistics
from typing import Any, Dict, Iterable, List, Optional

import requests
from dotenv import dotenv_values, find_dotenv, load_dotenv
from PIL import Image
from PIL import ImageChops


DEFAULT_MODEL = "gemini-2.5-flash-image"


DEFAULT_PROMPT = """\
Create a clean studio product photo of a single plant.

Requirements:
- Scientific name (species): {scientific_name}
- Depict a mature, full-grown specimen for this species (not a seedling, sapling, juvenile, cutting, or sprout).
- Show ONE plant only, full plant visible from base to top.
- Side view (not top-down), upright natural posture.
- Tight framing with minimal whitespace: the plant should fill ~80–90% of the frame while still fully visible.
- Centered composition with small, even margins (no large empty border).
- Pure white seamless background (#FFFFFF), no scene/background elements.
- Realistic botanical detail: preserve leaf shapes, stem structure, and flower color.
- No pot, no vase, no soil, no labels, no text, no watermark, no hands, no extra plants.
- Soft even lighting; avoid harsh shadows and reflections.
- Absolutely no shadows of any kind (no grounding/contact shadow, no cast shadow, no ambient occlusion).
- Background must be perfectly uniform pure white (#FFFFFF) with no gradients, vignetting, haze, halos, or gray under the plant.
"""


def _get_env_api_key() -> Optional[str]:
    """
    Prefer reading from `.env` directly (repo convention uses `goog-api-key`, which
    can be awkward as an OS-level env var on Windows). Fall back to process env.
    """
    env_path = find_dotenv(usecwd=True) or ""
    if env_path:
        values = dotenv_values(env_path)
        key = (
            values.get("goog-api-key")
            or values.get("GOOG_API_KEY")
            or values.get("GOOGLE_API_KEY")
            or values.get("GEMINI_API_KEY")
        )
        if key:
            return str(key)

    return os.getenv("GOOG_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")


def _guess_mime_type(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    # Fallbacks
    ext = path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    return "application/octet-stream"


def _b64encode_bytes(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _safe_stem(name: str) -> str:
    # Keep original stem for matching; do minimal normalization for comparisons
    return Path(name).stem.strip()


def _candidate_outputs(output_dir: Path, input_filename: str) -> List[Path]:
    """
    Output naming strategy:
    - Prefer same name as input if output mime matches extension
    - But for "skip existing", treat any existing of common image extensions
      with the same stem as "already generated".
    """
    stem = _safe_stem(input_filename)
    return [
        output_dir / f"{stem}.webp",
        output_dir / f"{stem}.jpg",
        output_dir / f"{stem}.jpeg",
        output_dir / f"{stem}.png",
        output_dir / input_filename,
    ]


def iter_input_images(input_dir: Path, output_dir: Path, skip_preview: bool) -> Iterable[Path]:
    for p in sorted(input_dir.iterdir()):
        if p.is_dir():
            # Ignore output dir and any other subdirs by default
            if p.resolve() == output_dir.resolve():
                continue
            continue
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        if skip_preview and p.name.lower().endswith(".preview.jpg"):
            continue
        yield p


def iter_input_images_from_list(
    *,
    list_path: Path,
    input_dir: Path,
    output_dir: Path,
    skip_preview: bool,
) -> Iterable[Path]:
    """
    Iterate input images from a text file list.

    Lines may be:
    - a filename (e.g. "Acer rubrum.jpg") -> resolved under input_dir
    - a relative path (e.g. "images/Acer rubrum.jpg") -> resolved from CWD first, then input_dir
    - an absolute path
    Blank lines and lines starting with '#' are ignored.
    """
    if not list_path.exists():
        raise FileNotFoundError(f"Input list not found: {list_path}")

    for raw in list_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        p = Path(line)
        candidates: list[Path] = []
        if p.is_absolute():
            candidates = [p]
        else:
            candidates = [
                Path.cwd() / p,
                input_dir / p,
            ]

        chosen: Optional[Path] = None
        for c in candidates:
            if c.exists():
                chosen = c
                break

        if not chosen:
            print(f"[WARN] input missing (skipping): {line}")
            continue

        if chosen.is_dir():
            print(f"[WARN] input is a directory (skipping): {chosen}")
            continue

        # Respect the same input rules as iter_input_images()
        if chosen.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            print(f"[WARN] not an image file (skipping): {chosen}")
            continue
        if skip_preview and chosen.name.lower().endswith(".preview.jpg"):
            continue
        # Avoid accidentally processing the output directory contents
        try:
            if chosen.resolve().parent == output_dir.resolve():
                continue
        except Exception:
            # If resolve() fails, just proceed; worst-case skip logic later prevents overwrite.
            pass

        yield chosen


def _looks_like_image_path(p: Path) -> bool:
    return p.suffix.lower() in (".jpg", ".jpeg", ".png")


def _resolve_single_input_path(
    *,
    raw_path: str,
    input_dir: Path,
    output_dir: Path,
    skip_preview: bool,
) -> Optional[Path]:
    """
    Resolve a single input image path or filename using the same rules as list entries.
    Returns None if not a valid input image.
    """
    line = (raw_path or "").strip()
    if not line:
        return None
    p = Path(line)
    candidates: list[Path]
    if p.is_absolute():
        candidates = [p]
    else:
        candidates = [Path.cwd() / p, input_dir / p]

    chosen: Optional[Path] = None
    for c in candidates:
        if c.exists():
            chosen = c
            break
    if not chosen or chosen.is_dir():
        return None
    if chosen.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        return None
    if skip_preview and chosen.name.lower().endswith(".preview.jpg"):
        return None
    try:
        if chosen.resolve().parent == output_dir.resolve():
            return None
    except Exception:
        pass
    return chosen


@dataclass
class GeminiImagePart:
    mime_type: str
    data_b64: str

    def bytes(self) -> bytes:
        return base64.b64decode(self.data_b64)


def _extract_image_part(resp_json: Dict[str, Any]) -> GeminiImagePart:
    """
    Gemini responses may contain image bytes as inlineData/inline_data.
    We scan candidates[0].content.parts for the first inline image part.
    """
    candidates = resp_json.get("candidates") or []
    if not candidates:
        raise ValueError("No candidates in response.")

    content = (candidates[0] or {}).get("content") or {}
    parts = content.get("parts") or []
    if not isinstance(parts, list) or not parts:
        raise ValueError("No content.parts in response.")

    for part in parts:
        if not isinstance(part, dict):
            continue

        inline = part.get("inlineData") or part.get("inline_data")
        if isinstance(inline, dict):
            mime_type = inline.get("mimeType") or inline.get("mime_type") or "application/octet-stream"
            data = inline.get("data")
            if isinstance(data, str) and data:
                return GeminiImagePart(mime_type=mime_type, data_b64=data)

    raise ValueError("No inline image part found in response content.parts.")


def _build_payload(prompt: str, image_mime: str, image_bytes: bytes) -> Dict[str, Any]:
    # REST JSON uses inline_data with { mime_type, data(base64) }
    return {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": image_mime,
                            "data": _b64encode_bytes(image_bytes),
                        }
                    },
                ]
            }
        ]
    }


def _render_prompt(prompt_template: str, scientific_name: str) -> str:
    """
    Render the prompt for a specific image.

    If the template includes '{scientific_name}', it will be substituted.
    Otherwise, we append a line to ensure the species name is included.
    """
    if "{scientific_name}" in prompt_template:
        return prompt_template.format(scientific_name=scientific_name)
    return f"{prompt_template.rstrip()}\n\nScientific name (species): {scientific_name}\n"


def _request_with_retries(
    *,
    url: str,
    api_key: str,
    payload: Dict[str, Any],
    timeout_s: int,
    max_retries: int,
    base_sleep_s: float,
) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
            if r.status_code in (429, 500, 502, 503, 504):
                raise RuntimeError(f"Transient HTTP {r.status_code}: {r.text[:500]}")
            if r.status_code < 200 or r.status_code >= 300:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:1000]}")
            return r.json()
        except Exception as e:
            last_err = e
            if attempt >= max_retries:
                break
            # Exponential backoff with jitter
            sleep_s = base_sleep_s * (2**attempt) + random.uniform(0, 0.25)
            time.sleep(sleep_s)

    raise RuntimeError(f"Request failed after {max_retries + 1} attempts: {last_err}") from last_err


def _choose_output_path(
    output_dir: Path,
    input_filename: str,
    out_mime: str,
) -> Path:
    stem = _safe_stem(input_filename)
    ext = ".png" if out_mime == "image/png" else ".jpg" if out_mime in ("image/jpeg", "image/jpg") else ""
    if ext:
        return output_dir / f"{stem}{ext}"
    # Unknown mime: keep input extension
    return output_dir / input_filename


def _autocrop_white_margins(
    img: Image.Image,
    *,
    mode: str,
    threshold: int,
    pad_px: int,
) -> Image.Image:
    """
    Crop to the bounding box of the plant.

    Modes:
    - bg-diff: estimate background color from corners, then crop based on pixel difference.
      threshold is a 0..255 difference cutoff; higher keeps more background.
    - near-white: treat pixels with all RGB >= threshold as background.

    - threshold: meaning depends on mode (see above)
    - pad_px: extra pixels to include around the detected bounding box
    """
    mode = (mode or "").strip().lower()
    if mode not in ("bg-diff", "near-white"):
        mode = "bg-diff"

    # Work in RGB (we generally expect no alpha). If alpha exists, keep it in original img,
    # but crop bounds are computed from RGB.
    rgb = img.convert("RGB")
    w, h = rgb.size

    def _expand_bbox(bbox: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        left, top, right, bottom = bbox
        left = max(left - pad_px, 0)
        top = max(top - pad_px, 0)
        right = min(right + pad_px, w)
        bottom = min(bottom + pad_px, h)
        return (left, top, right, bottom)

    if mode == "near-white":
        rgba = img.convert("RGBA")
        px = rgba.load()
        min_x, min_y = w, h
        max_x, max_y = -1, -1

        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if r >= threshold and g >= threshold and b >= threshold:
                    continue
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y

        if max_x < 0 or max_y < 0:
            return img
        return img.crop(_expand_bbox((min_x, min_y, max_x + 1, max_y + 1)))

    # bg-diff mode (robust to faint vignettes / haze)
    # Estimate background from the *whitest* corner patch (to avoid cases where a corner includes plant pixels).
    patch = max(6, min(24, min(w, h) // 18))
    corners: list[tuple[int, int]] = [(0, 0), (w - patch, 0), (0, h - patch), (w - patch, h - patch)]

    best_bg: Optional[tuple[int, int, int]] = None
    best_luma: float = -1.0

    for cx, cy in corners:
        crop = rgb.crop((cx, cy, cx + patch, cy + patch))
        data = list(crop.getdata())
        if not data:
            continue
        rs = [p[0] for p in data]
        gs = [p[1] for p in data]
        bs = [p[2] for p in data]
        bg = (
            int(statistics.median(rs)),
            int(statistics.median(gs)),
            int(statistics.median(bs)),
        )
        luma = (bg[0] + bg[1] + bg[2]) / 3.0
        if luma > best_luma:
            best_luma = luma
            best_bg = bg

    if not best_bg:
        return img

    bg = Image.new("RGB", rgb.size, best_bg)
    diff = ImageChops.difference(rgb, bg).convert("L")
    # Auto-adapt threshold based on how noisy the background is in the chosen corner patch.
    # This prevents faint gray haze / gradients from being mistaken as "foreground" and blocking cropping.
    corner_x, corner_y = corners[0]
    # Recompute which corner was "best" (whitest) so we sample the same patch for noise stats.
    # Find the corner whose median color matches best_bg the closest.
    best_corner = corners[0]
    best_corner_dist = 10**9
    for cx, cy in corners:
        crop = rgb.crop((cx, cy, cx + patch, cy + patch))
        data = list(crop.getdata())
        if not data:
            continue
        rs = [p[0] for p in data]
        gs = [p[1] for p in data]
        bs = [p[2] for p in data]
        med = (
            int(statistics.median(rs)),
            int(statistics.median(gs)),
            int(statistics.median(bs)),
        )
        dist = abs(med[0] - best_bg[0]) + abs(med[1] - best_bg[1]) + abs(med[2] - best_bg[2])
        if dist < best_corner_dist:
            best_corner_dist = dist
            best_corner = (cx, cy)

    corner_x, corner_y = best_corner
    noise_patch = diff.crop((corner_x, corner_y, corner_x + patch, corner_y + patch))
    noise_vals = list(noise_patch.getdata())
    if noise_vals:
        med = float(statistics.median(noise_vals))
        mad = float(statistics.median([abs(v - med) for v in noise_vals]))
        # Robust threshold: median + k * MAD + small buffer, clamped.
        auto_thr = int(min(80, max(3, med + 8 * mad + 2)))
        thr = max(int(threshold), auto_thr)
    else:
        thr = int(threshold)

    # Threshold diff into mask; bbox on the mask.
    mask = diff.point(lambda p: 255 if p > thr else 0)
    bbox = mask.getbbox()

    # If diff-based bbox fails (or is effectively the whole image because bg estimate was wrong),
    # fall back to near-white cropping.
    if not bbox:
        return _autocrop_white_margins(img, mode="near-white", threshold=250, pad_px=pad_px)

    left, top, right, bottom = bbox
    if (right - left) >= int(w * 0.98) and (bottom - top) >= int(h * 0.98):
        return _autocrop_white_margins(img, mode="near-white", threshold=250, pad_px=pad_px)

    return img.crop(_expand_bbox(bbox))


def _maybe_autocrop_bytes(
    img_bytes: bytes,
    *,
    mime_type: str,
    enabled: bool,
    crop_mode: str,
    threshold: int,
    pad_px: int,
    output_format: str,
    webp_quality: int,
) -> bytes:
    img = Image.open(BytesIO(img_bytes))
    if enabled:
        img = _autocrop_white_margins(img, mode=crop_mode, threshold=threshold, pad_px=pad_px)

    out = BytesIO()

    fmt = output_format.lower()
    if fmt == "keep":
        # Preserve model output format (best-effort)
        if mime_type == "image/png":
            img.save(out, format="PNG", optimize=True)
            return out.getvalue()
        if mime_type in ("image/jpeg", "image/jpg"):
            if img.mode in ("RGBA", "LA"):
                img = img.convert("RGB")
            img.save(out, format="JPEG", quality=95, optimize=True)
            return out.getvalue()
        # Unknown -> default to WebP
        fmt = "webp"

    if fmt == "png":
        img.save(out, format="PNG", optimize=True)
        return out.getvalue()

    if fmt == "jpg" or fmt == "jpeg":
        if img.mode in ("RGBA", "LA"):
            img = img.convert("RGB")
        img.save(out, format="JPEG", quality=95, optimize=True)
        return out.getvalue()

    # Default: webp
    if img.mode in ("RGBA", "LA"):
        # Keep alpha if present (shouldn't be, but safe)
        img.save(out, format="WEBP", quality=webp_quality, method=6)
        return out.getvalue()
    img.save(out, format="WEBP", quality=webp_quality, method=6)
    return out.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate studio plant images via Gemini (dev-only).")
    parser.add_argument("--input-dir", default="images", help="Directory containing input photos (default: images)")
    parser.add_argument(
        "--input-list",
        default=None,
        help=(
            "Optional path to a text file listing specific input images to process. "
            "Each line should be a filename or path. Blank lines and lines starting with '#' are ignored."
        ),
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path("images") / "studio_full"),
        help="Directory to write generated studio images (default: images/studio_full)",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini model (default: {DEFAULT_MODEL})")
    parser.add_argument(
        "--endpoint",
        default=None,
        help="Override full REST endpoint URL (default: derived from --model)",
    )
    parser.add_argument("--prompt-file", default=None, help="Path to a text file containing the prompt.")
    parser.add_argument(
        "--scientific-name",
        default="",
        help="Override scientific name used in the prompt (default: derived from filename stem).",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing outputs.")
    parser.add_argument(
        "--skip-preview",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Skip *.preview.jpg (default: true). Use --no-skip-preview to include them.",
    )
    parser.add_argument(
        "--autocrop",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Auto-crop white margins on the generated output (default: true). Use --no-autocrop to disable.",
    )
    parser.add_argument(
        "--crop-mode",
        choices=["bg-diff", "near-white"],
        default="bg-diff",
        help="Cropping algorithm (default: bg-diff). bg-diff handles faint haze/vignettes better.",
    )
    parser.add_argument(
        "--crop-threshold",
        type=int,
        default=12,
        help=(
            "0..255. For crop-mode=bg-diff: higher keeps more background (default: 12). "
            "For crop-mode=near-white: higher crops more aggressively (e.g. 250)."
        ),
    )
    parser.add_argument(
        "--crop-padding",
        type=int,
        default=24,
        help="Extra pixels to keep around the detected plant bounds (default: 24).",
    )
    parser.add_argument(
        "--output-format",
        choices=["webp", "jpg", "png", "keep"],
        default="webp",
        help="Final output image format (default: webp). 'keep' preserves model output type.",
    )
    parser.add_argument(
        "--webp-quality",
        type=int,
        default=90,
        help="WebP quality 0..100 (default: 90). Only used when --output-format=webp.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Process at most N images (0 = no limit).")
    parser.add_argument("--dry-run", action="store_true", help="List planned work but do not call the API/write files.")
    parser.add_argument("--timeout", type=int, default=120, help="HTTP timeout seconds (default: 120).")
    parser.add_argument("--max-retries", type=int, default=3, help="Retries for transient errors (default: 3).")
    parser.add_argument("--base-sleep", type=float, default=1.0, help="Base sleep for retry backoff (default: 1.0).")
    parser.add_argument("--sleep", type=float, default=0.0, help="Sleep seconds between successful requests (default: 0).")

    args = parser.parse_args()

    load_dotenv()
    api_key = _get_env_api_key()
    if not args.dry_run and not api_key:
        print("ERROR: Missing API key. Set `goog-api-key` in .env (or GOOG_API_KEY/GOOGLE_API_KEY/GEMINI_API_KEY).")
        return 2

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    prompt = DEFAULT_PROMPT
    if args.prompt_file:
        prompt_path = Path(args.prompt_file)
        if not prompt_path.exists():
            print(f"ERROR: Prompt file not found: {prompt_path}")
            return 2
        prompt = prompt_path.read_text(encoding="utf-8")

    endpoint = args.endpoint or (
        "https://generativelanguage.googleapis.com/v1beta/models/" f"{args.model}:generateContent"
    )

    processed = 0
    skipped = 0
    failed = 0

    if args.input_list:
        input_list_path = Path(args.input_list)
        # Convenience: if --input-list points directly to an image file, treat it as a single input.
        if _looks_like_image_path(input_list_path):
            resolved = _resolve_single_input_path(
                raw_path=str(args.input_list),
                input_dir=input_dir,
                output_dir=output_dir,
                skip_preview=args.skip_preview,
            )
            inputs = [resolved] if resolved else []
        else:
            inputs = list(
                iter_input_images_from_list(
                    list_path=input_list_path,
                    input_dir=input_dir,
                    output_dir=output_dir,
                    skip_preview=args.skip_preview,
                )
            )
    else:
        inputs = list(iter_input_images(input_dir=input_dir, output_dir=output_dir, skip_preview=args.skip_preview))
    if args.limit and args.limit > 0:
        inputs = inputs[: args.limit]

    if not inputs:
        print("No input images found.")
        return 0

    for img_path in inputs:
        scientific_name = str(args.scientific_name).strip() or _safe_stem(img_path.name)
        per_image_prompt = _render_prompt(prompt, scientific_name=scientific_name)

        existing = [p for p in _candidate_outputs(output_dir, img_path.name) if p.exists()]
        if existing and not args.overwrite:
            skipped += 1
            print(f"[SKIP] exists: {img_path.name} -> {existing[0].name}")
            continue

        if args.dry_run:
            planned = _candidate_outputs(output_dir, img_path.name)[0]
            print(f"[DRY] would generate: {img_path.name} -> {planned.name}")
            processed += 1
            continue

        try:
            image_bytes = img_path.read_bytes()
            image_mime = _guess_mime_type(img_path)
            payload = _build_payload(prompt=per_image_prompt, image_mime=image_mime, image_bytes=image_bytes)

            resp_json = _request_with_retries(
                url=endpoint,
                api_key=api_key or "",
                payload=payload,
                timeout_s=args.timeout,
                max_retries=args.max_retries,
                base_sleep_s=args.base_sleep,
            )

            part = _extract_image_part(resp_json)
            if args.output_format == "keep":
                out_path = _choose_output_path(
                    output_dir=output_dir, input_filename=img_path.name, out_mime=part.mime_type
                )
            else:
                out_path = output_dir / f"{_safe_stem(img_path.name)}.{args.output_format}"

            if out_path.exists() and not args.overwrite:
                skipped += 1
                print(f"[SKIP] exists: {img_path.name} -> {out_path.name}")
                continue

            out_bytes = _maybe_autocrop_bytes(
                part.bytes(),
                mime_type=part.mime_type,
                enabled=bool(args.autocrop),
                crop_mode=str(args.crop_mode),
                threshold=int(args.crop_threshold),
                pad_px=int(args.crop_padding),
                output_format=str(args.output_format),
                webp_quality=int(args.webp_quality),
            )
            out_path.write_bytes(out_bytes)
            processed += 1
            print(
                f"[OK] generated: {img_path.name} -> {out_path.name} ({part.mime_type}, autocrop={bool(args.autocrop)})"
            )

            if args.sleep and args.sleep > 0:
                time.sleep(args.sleep)

        except Exception as e:
            failed += 1
            print(f"[FAIL] {img_path.name} ({e})")

    print("\n===== Studio image generation summary =====")
    print(f"Processed: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Failed:    {failed}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())


