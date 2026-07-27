from sqlalchemy import create_engine, inspect, text

from app.database import ensure_daily_session_columns


def _legacy_engine():
    """Bảng đúng như hình dạng trước khi model thêm mode/started_at/duration_seconds.

    Dùng SQLite in-memory thay vì tmp_path: pytest.ini trỏ basetemp vào
    tests/.pytest-artifacts và thư mục đó không xoá được trên máy Windows này.
    """
    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE TABLE daily_sessions ("
            " id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,"
            " session_date DATE NOT NULL, status VARCHAR(20) NOT NULL,"
            " phase VARCHAR(20) NOT NULL, puzzle_json TEXT,"
            " created_at DATETIME NOT NULL, completed_at DATETIME)"
        ))
        conn.execute(text(
            "INSERT INTO daily_sessions (id, user_id, session_date, status, phase, created_at)"
            " VALUES ('s1', 'u1', '2026-07-01', 'learning', 'review', '2026-07-01 08:00:00')"
        ))
        conn.commit()
    return engine


def test_legacy_daily_sessions_gain_the_missing_columns():
    engine = _legacy_engine()

    ensure_daily_session_columns(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("daily_sessions")}
    assert {"mode", "started_at", "duration_seconds"} <= columns

    with engine.connect() as conn:
        row = conn.execute(text("SELECT mode, duration_seconds, started_at, created_at FROM daily_sessions")).one()
    assert row.mode == "full"
    assert row.duration_seconds == 0
    # started_at không có mặc định hằng nên phải được backfill từ created_at.
    assert row.started_at == row.created_at


def test_running_the_migration_twice_is_a_no_op():
    engine = _legacy_engine()

    ensure_daily_session_columns(engine)
    ensure_daily_session_columns(engine)

    columns = [column["name"] for column in inspect(engine).get_columns("daily_sessions")]
    assert columns.count("mode") == 1


def test_the_migration_skips_a_database_without_the_table():
    engine = create_engine("sqlite://")
    ensure_daily_session_columns(engine)
    assert not inspect(engine).has_table("daily_sessions")
