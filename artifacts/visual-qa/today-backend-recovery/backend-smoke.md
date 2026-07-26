# Render/Alembic checkpoint smoke test

Run from `backend` with an explicit temporary database URL:

```text
DATABASE_URL=sqlite:///C:/Users/Admin/AppData/Local/Temp/flashcards-alembic-smoke-beba1fe8-2e2a-4d74-86d3-4f6d295f996b.db
runtime: Python 3.12.13
requirements pins: SQLAlchemy 2.0.30; Alembic 1.15.2
IMPORT_OK app app.models
alembic current: PASS (SQLite context started; no ModuleNotFoundError)
alembic upgrade head: PASS
  upgrade -> 0001_current_schema
  upgrade 0001_current_schema -> 0002_learning_os
pytest: 118 passed in 41.07s
```

The smoke database is a unique SQLite file under the operating-system temporary directory. No project database, Supabase database, migration file, seed data, or production service was modified.

`render.yaml` remains configured with `rootDir: backend` and `healthCheckPath: /health`.
