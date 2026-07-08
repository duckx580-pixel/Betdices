import csv
import io
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException


def slugify_item_id(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return cleaned


def normalize_growtopia_import_row(raw: Dict[str, Any], row_number: int) -> Dict[str, Any]:
    item_name = str(raw.get("name", "")).strip()
    if not item_name:
        raise ValueError("name is required")
    item_id = slugify_item_id(str(raw.get("id") or item_name))
    if not item_id:
        raise ValueError("id is required")
    market_value_bgl_raw = raw.get("market_value_bgl")
    if market_value_bgl_raw is None or str(market_value_bgl_raw).strip() == "":
        raise ValueError("market_value_bgl is required")
    try:
        market_value_bgl = round(float(market_value_bgl_raw), 4)
    except (TypeError, ValueError):
        raise ValueError("market_value_bgl must be numeric")
    if market_value_bgl < 0:
        raise ValueError("market_value_bgl must be >= 0")
    icon_url = str(raw.get("icon_url", "")).strip()
    if not icon_url:
        raise ValueError("icon_url is required")
    if not re.match(r"^https?://", icon_url, re.IGNORECASE):
        raise ValueError("icon_url must be an absolute http(s) URL")
    return {
        "id": item_id,
        "name": item_name,
        "market_value_bgl": market_value_bgl,
        "icon_url": icon_url,
        "row_number": row_number,
    }


def parse_growtopia_import_file(filename: str, raw_bytes: bytes) -> Dict[str, Any]:
    ext = Path(filename or "").suffix.lower()
    if ext not in (".json", ".csv"):
        raise HTTPException(400, "Only .json and .csv files are supported")

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded")

    rows: List[Dict[str, Any]] = []
    if ext == ".json":
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid JSON format")
        if not isinstance(payload, list):
            raise HTTPException(400, "JSON must be an array of item objects")
        rows = payload
    else:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(400, "CSV header is required")
        rows = [row for row in reader]

    normalized: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()

    for idx, row in enumerate(rows, start=1):
        try:
            clean = normalize_growtopia_import_row(row or {}, idx)
            if clean["id"] in seen_ids:
                raise ValueError(f"duplicate id '{clean['id']}' in uploaded file")
            seen_ids.add(clean["id"])
            normalized.append(clean)
        except ValueError as err:
            _ = err
            rejected.append({"row": idx, "error": "invalid_row"})

    return {"items": normalized, "rejected": rejected, "total_rows": len(rows)}


def load_default_growtopia_items(seed_path: Path, logger: Optional[Any] = None) -> List[Dict[str, Any]]:
    if not seed_path.exists():
        if logger:
            logger.warning("Growtopia seed file not found at %s", seed_path)
        return []
    try:
        raw = seed_path.read_bytes()
        parsed = parse_growtopia_import_file(seed_path.name, raw)
        return parsed["items"]
    except Exception:
        if logger:
            logger.exception("Failed to load Growtopia seed items")
        return []
