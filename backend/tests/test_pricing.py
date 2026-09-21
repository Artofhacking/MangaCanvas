import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.errors import ApiError
from app import models
from app.pricing import quote_request
from app.seed import seed_price_rules


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, future=True)
    session = Session()
    seed_price_rules(session)
    session.commit()
    yield session
    session.close()


def test_wan_standard_quality_hits_empty_row(db):
    quoted = quote_request(db, model="wan2.7-image", modality="image", quality="standard", n=1)
    assert quoted.credits == 20
    assert quoted.model_id == "wan2.7-image"


def test_gpt_omitted_quality_is_medium(db):
    quoted = quote_request(db, model="gpt-image-2", modality="image", n=1)
    assert quoted.credits == 39
    assert quoted.quality == "medium"


def test_gpt_25_high_n2(db):
    quoted = quote_request(db, model="gpt-image-2.5-sunburst", modality="image", quality="high", n=2)
    assert quoted.credits == 304


def test_happyhorse_r2v_720p(db):
    quoted = quote_request(
        db,
        model="happyhorse-1.1-r2v",
        modality="video",
        duration=5,
        size="1280*720",
        resolution="720P",
        image_count=2,
    )
    assert quoted.model_id == "happyhorse-1.1-r2v"
    assert quoted.resolution == "720p"
    assert quoted.credits == 600


def test_body_1080p_hits_seed_1080p(db):
    quoted = quote_request(
        db,
        model="happyhorse-1.1-t2v",
        modality="video",
        duration=5,
        size="1440*1440",
        resolution="1080P",
    )
    assert quoted.resolution == "1080p"
    assert quoted.credits == 1000


def test_size_1440_without_resolution_is_1080p(db):
    quoted = quote_request(db, model="happyhorse-1.1-t2v", modality="video", duration=5, size="1440*1440")
    assert quoted.resolution == "1080p"
    assert quoted.credits == 1000


def test_minimax_h3_max_maps_to_768p(db):
    quoted = quote_request(
        db,
        model="MiniMax-H3-Max",
        modality="video",
        duration=5,
        size="1920*1080",
        resolution="1080P",
    )
    assert quoted.resolution == "768p"
    assert quoted.credits == 250


def test_chat_xai_ignores_body_model(db, monkeypatch):
    monkeypatch.setattr("app.pricing.settings.xai_api_key", "xai-test")
    quoted = quote_request(db, model="qwen-plus", modality="text")
    assert quoted.model_id == "grok-4.5"
    assert quoted.credits == 2


def test_script_parse_qwen(db, monkeypatch):
    monkeypatch.setattr("app.pricing.settings.xai_api_key", "")
    monkeypatch.setattr("app.pricing.settings.openai_api_key", "sk-test")
    quoted = quote_request(db, model="qwen-plus", modality="text", unit="script_parse")
    assert quoted.model_id == "qwen-plus"
    assert quoted.credits == 4


def test_illegal_duration(db):
    with pytest.raises(ApiError) as exc:
        quote_request(db, model="happyhorse-1.1-t2v", modality="video", duration=12)
    assert exc.value.code == 1001


def test_seed_does_not_overwrite_price(db):
    row = db.query(models.BillingPriceRule).filter_by(model_id="gpt-image-2", quality="medium").first()
    row.credits_per_unit = 99
    db.commit()
    seed_price_rules(db)
    db.commit()
    again = db.query(models.BillingPriceRule).filter_by(model_id="gpt-image-2", quality="medium").first()
    assert again.credits_per_unit == 99
