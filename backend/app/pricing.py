from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from . import models
from .ai_media import (
    is_minimax_model,
    is_seedance_model,
    is_vidu_model,
    minimax_resolution,
    billed_chat_model,
    openai_quality,
    resolve_video_model,
    seedance_duration,
    seedance_resolution,
    vidu_resolution,
)
from .config import settings
from .errors import fail


@dataclass(frozen=True)
class Quote:
    model_id: str
    modality: str
    unit: str
    unit_count: int
    unit_price: int
    credits: int
    quality: str
    resolution: str
    rule_id: int


def resolve_billed_chat_model(_body_model: str | None) -> str:
    return billed_chat_model(_body_model)


def canon_resolution(value: str | None) -> str:
    raw = (value or "").strip().lower().replace(" ", "")
    mapping = {
        "720p": "720p",
        "720": "720p",
        "1080p": "1080p",
        "1080": "1080p",
        "768p": "768p",
        "768": "768p",
        "2k": "2k",
        "480p": "480p",
        "480": "480p",
    }
    return mapping.get(raw, "")


def resolve_image_model(model: str) -> str:
    raw = (model or "").strip()
    if not settings.dashscope_api_key and raw.startswith("wan") and not raw.startswith("wan2.7"):
        return "wan2.7-image"
    return raw


def resolve_billed_video_model(
    model: str,
    *,
    has_image: bool = False,
    image_count: int = 0,
    template: str | None = None,
) -> str:
    if template:
        return "happyhorse-1.1-i2v"
    raw = (model or "").strip()
    if is_seedance_model(raw) or is_minimax_model(raw) or is_vidu_model(raw):
        return resolve_video_model(raw, has_image)
    if image_count >= 2 or "r2v" in raw.lower():
        return "happyhorse-1.1-r2v"
    if has_image or image_count >= 1:
        return resolve_video_model(raw, True)
    return resolve_video_model(raw, False)


def happyhorse_billing_resolution(size: str | None, resolution: str | None) -> str:
    canon = canon_resolution(resolution)
    if canon in {"720p", "1080p"}:
        return canon
    raw = str(size or "").lower()
    if any(token in raw for token in ("1440", "1632", "1248", "1920", "1080")):
        return "1080p"
    return "720p"


def billed_video_resolution(model_id: str, size: str | None, resolution: str | None) -> str:
    if is_seedance_model(model_id):
        return canon_resolution(seedance_resolution(model_id, size, resolution)) or "720p"
    if is_minimax_model(model_id):
        return canon_resolution(minimax_resolution(model_id, size, resolution))
    if is_vidu_model(model_id):
        return canon_resolution(vidu_resolution(size, resolution)) or "720p"
    return happyhorse_billing_resolution(size, resolution)


def _lookup_rule(db: Session, model_id: str, unit: str, quality: str, resolution: str) -> models.BillingPriceRule:
    base = db.query(models.BillingPriceRule).filter_by(model_id=model_id, unit=unit, is_active=True)
    if unit == "video_second":
        row = base.filter_by(quality="", resolution=resolution).first()
        if not row:
            fail(1001, f"无匹配价目: {model_id} {resolution}", 400)
        return row
    if quality:
        row = base.filter_by(quality=quality, resolution="").first()
        if row:
            return row
    row = base.filter_by(quality="", resolution="").first()
    if not row:
        fail(1001, f"无匹配价目: {model_id}", 400)
    return row


def quote_request(
    db: Session,
    *,
    model: str,
    modality: str,
    n: int | None = None,
    quality: str | None = None,
    size: str | None = None,
    resolution: str | None = None,
    duration: int | None = None,
    unit: str | None = None,
    image_count: int = 0,
    template: str | None = None,
) -> Quote:
    kind = (modality or "").strip().lower()
    if kind in {"script", "script_parse"}:
        kind = "text"
        unit = "script_parse"
    if kind not in {"image", "video", "text"}:
        fail(1001, "未知 modality", 400)

    count = 1 if n is None else int(n)
    if count < 1 or count > 4:
        fail(1001, "n 必须在 1–4", 400)

    if kind == "image":
        model_id = resolve_image_model(model)
        canon_quality = openai_quality(quality)
        rule = _lookup_rule(db, model_id, "image", canon_quality, "")
        return Quote(
            model_id=model_id,
            modality="image",
            unit="image",
            unit_count=count,
            unit_price=rule.credits_per_unit,
            credits=rule.credits_per_unit * count,
            quality=canon_quality if rule.quality else "",
            resolution="",
            rule_id=rule.id,
        )

    if kind == "video":
        seconds = 5 if duration is None else int(duration)
        if seconds not in {5, 10, 15}:
            fail(1001, "duration 必须是 5、10 或 15", 400)
        has_image = image_count > 0 or bool(template)
        model_id = resolve_billed_video_model(
            model, has_image=has_image, image_count=image_count, template=template
        )
        if is_seedance_model(model_id):
            seconds = seedance_duration(model_id, seconds)
        billed_res = billed_video_resolution(model_id, size, resolution)
        if not billed_res:
            fail(1001, f"无匹配价目: {model_id}", 400)
        rule = _lookup_rule(db, model_id, "video_second", "", billed_res)
        return Quote(
            model_id=model_id,
            modality="video",
            unit="video_second",
            unit_count=seconds,
            unit_price=rule.credits_per_unit,
            credits=rule.credits_per_unit * seconds,
            quality="",
            resolution=billed_res,
            rule_id=rule.id,
        )

    billed_unit = unit if unit in {"chat_request", "script_parse"} else "chat_request"
    model_id = resolve_billed_chat_model(model)
    rule = _lookup_rule(db, model_id, billed_unit, "", "")
    return Quote(
        model_id=model_id,
        modality="text",
        unit=billed_unit,
        unit_count=1,
        unit_price=rule.credits_per_unit,
        credits=rule.credits_per_unit,
        quality="",
        resolution="",
        rule_id=rule.id,
    )
