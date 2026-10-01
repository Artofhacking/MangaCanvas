"""Lightweight canvas collection sizes for workflow list responses.

The list query must not SELECT ``canvas_data``. MySQL filesort copies selected
columns into the sort buffer and raises 1038 once a workflow payload is large.
Callers run this expression in a separate, unordered lookup.
"""

from sqlalchemy import and_, case, func
from sqlalchemy.sql.elements import ColumnElement


def canvas_collection_count(column: ColumnElement, path: str, dialect: str):
    """Count a JSON array at ``path`` without selecting the document.

    Non-arrays (missing key, object, null) count as 0 so the UI can tell a
    true empty canvas from a value it never loaded.
    """
    if dialect in {"mysql", "mariadb"}:
        return case(
            (
                func.json_type(func.json_extract(column, path)) == "ARRAY",
                func.json_length(column, path),
            ),
            else_=0,
        )
    return case(
        (
            func.json_type(column, path) == "array",
            func.json_array_length(column, path),
        ),
        else_=0,
    )


def canvas_nodes_are_empty(column: ColumnElement, dialect: str):
    """True only when ``nodes`` is a JSON array of length 0.

    Non-arrays stay put. A broken document is not an empty canvas we can delete.
    """
    path = "$.nodes"
    if dialect in {"mysql", "mariadb"}:
        return and_(
            func.json_type(func.json_extract(column, path)) == "ARRAY",
            func.json_length(column, path) == 0,
        )
    return and_(
        func.json_type(column, path) == "array",
        func.json_array_length(column, path) == 0,
    )
