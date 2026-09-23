from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _index_names(inspector, table: str) -> set[str]:
    if table not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(table) if index.get("name")}


def _add_mysql_index(engine: Engine, ddl: str) -> None:
    with engine.begin() as connection:
        try:
            connection.execute(text(ddl))
        except Exception:
            pass


_PROMPT_LOCK_TABLES = ("characters", "scenes", "project_objects")


def ensure_prompt_lock_columns(engine: Engine) -> None:
    """Add prompt lock columns on existing databases. Fresh create_all already has them."""
    inspector = inspect(engine)
    dialect = engine.dialect.name
    locked_type = "BOOLEAN NOT NULL DEFAULT 0" if dialect == "sqlite" else "TINYINT(1) NOT NULL DEFAULT 0"
    for table in _PROMPT_LOCK_TABLES:
        if table not in inspector.get_table_names():
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        with engine.begin() as connection:
            if "prompt_locked" not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN prompt_locked {locked_type}"))
            if "prompt_locked_at" not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN prompt_locked_at DATETIME NULL"))


def migrate_schema(engine: Engine) -> None:
    ensure_prompt_lock_columns(engine)
    inspector = inspect(engine)
    dialect = engine.dialect.name
    if "billing_project_quotas" in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE billing_project_quotas SET quota_limit = 0 "
                    "WHERE quota_limit = 100000 AND quota_consumed = 0"
                )
            )
    price_indexes = _index_names(inspector, "billing_price_rules")
    if dialect != "sqlite" and "uq_billing_price_rule" not in price_indexes:
        _add_mysql_index(
            engine,
            "ALTER TABLE billing_price_rules "
            "ADD UNIQUE INDEX uq_billing_price_rule (model_id, unit, quality, resolution)",
        )
    if dialect == "sqlite":
        return
    reservation_indexes = _index_names(inspect(engine), "billing_reservations")
    if "ix_billing_reservations_expiry" not in reservation_indexes:
        _add_mysql_index(
            engine,
            "ALTER TABLE billing_reservations ADD INDEX ix_billing_reservations_expiry (status, expires_at)",
        )
    if "ix_billing_reservations_user_status" not in reservation_indexes:
        _add_mysql_index(
            engine,
            "ALTER TABLE billing_reservations ADD INDEX ix_billing_reservations_user_status (user_id, status)",
        )
    if "uq_billing_reservation_user_key" not in reservation_indexes:
        _add_mysql_index(
            engine,
            "ALTER TABLE billing_reservations "
            "ADD UNIQUE INDEX uq_billing_reservation_user_key (user_id, idempotency_key)",
        )
    ledger_indexes = _index_names(inspect(engine), "billing_ledger")
    if "ix_billing_ledger_user_id" not in ledger_indexes:
        _add_mysql_index(
            engine,
            "ALTER TABLE billing_ledger ADD INDEX ix_billing_ledger_user_id (user_id, id)",
        )
