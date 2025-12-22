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
from typing import Any, Dict, Iterable, List, Optional

import requests
from dotenv import dotenv_values, find_dotenv, load_dotenv
from PIL import Image


DEFAULT_MODEL = "gemini-2.5-flash-image"
DEFAULT_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{DEFAULT_MODEL}:generateContent"
)


DEFAULT_PROMPT = """\
Create a clean studio product photo of a single plant.

Requirements:
- Show ONE plant only, full plant visible from base to top.
- Side view (not top-down), upright natural posture.
- Tight framing with minimal whitespace: the plant should fill ~80–90% of the frame while still fully visible.
- Centered composition with small, even margins (no large empty border).
- Pure white seamless background (#FFFFFF), no scene/background elements.
- Realistic botanical detail: preserve leaf shapes, stem structure, and flower color.
- No pot, no vase, no soil, no labels, no text, no watermark, no hands, no extra plants.
- Soft even lighting; avoid harsh shadows and reflections.
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
    threshold: int,
    pad_px: int,
) -> Image.Image:
    """
    Crop to the bounding box of "non-white" pixels, where a pixel is considered white if
    all RGB channels >= threshold.

    - threshold: 0..255, higher = more aggressive cropping
    - pad_px: extra pixels to include around the detected bounding box
    """
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")

    # Work in RGBA so we can ignore transparent pixels if they exist.
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

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

    # If we didn't find anything non-white, return original.
    if max_x < 0 or max_y < 0:
        return img

    left = max(min_x - pad_px, 0)
    top = max(min_y - pad_px, 0)
    right = min(max_x + pad_px + 1, w)
    bottom = min(max_y + pad_px + 1, h)

    return img.crop((left, top, right, bottom))


def _maybe_autocrop_bytes(
    img_bytes: bytes,
    *,
    mime_type: str,
    enabled: bool,
    threshold: int,
    pad_px: int,
) -> bytes:
    if not enabled:
        return img_bytes

    img = Image.open(BytesIO(img_bytes))
    cropped = _autocrop_white_margins(img, threshold=threshold, pad_px=pad_px)

    out = BytesIO()
    if mime_type == "image/png":
        cropped.save(out, format="PNG", optimize=True)
        return out.getvalue()

    # Default to JPEG for everything else.
    if cropped.mode in ("RGBA", "LA"):
        cropped = cropped.convert("RGB")
    cropped.save(out, format="JPEG", quality=95, optimize=True)
    return out.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate studio plant images via Gemini (dev-only).")
    parser.add_argument("--input-dir", default="images", help="Directory containing input photos (default: images)")
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
        "--crop-threshold",
        type=int,
        default=250,
        help="0..255. Higher crops more aggressively by treating near-white as background (default: 250).",
    )
    parser.add_argument(
        "--crop-padding",
        type=int,
        default=24,
        help="Extra pixels to keep around the detected plant bounds (default: 24).",
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

    inputs = list(iter_input_images(input_dir=input_dir, output_dir=output_dir, skip_preview=args.skip_preview))
    if args.limit and args.limit > 0:
        inputs = inputs[: args.limit]

    if not inputs:
        print("No input images found.")
        return 0

    for img_path in inputs:
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
            payload = _build_payload(prompt=prompt, image_mime=image_mime, image_bytes=image_bytes)

            resp_json = _request_with_retries(
                url=endpoint,
                api_key=api_key or "",
                payload=payload,
                timeout_s=args.timeout,
                max_retries=args.max_retries,
                base_sleep_s=args.base_sleep,
            )

            part = _extract_image_part(resp_json)
            out_path = _choose_output_path(output_dir=output_dir, input_filename=img_path.name, out_mime=part.mime_type)

            if out_path.exists() and not args.overwrite:
                skipped += 1
                print(f"[SKIP] exists: {img_path.name} -> {out_path.name}")
                continue

            out_bytes = _maybe_autocrop_bytes(
                part.bytes(),
                mime_type=part.mime_type,
                enabled=bool(args.autocrop),
                threshold=int(args.crop_threshold),
                pad_px=int(args.crop_padding),
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


