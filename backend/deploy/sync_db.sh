#!/usr/bin/env sh
# Copy the locally ingested corpus (documents + chunks) into the hosted database.
# Embedding is slow on small machines, so we ingest once locally and ship the result.
#
#   PROD_DATABASE_URL=postgresql+psycopg://... sh deploy/sync_db.sh
set -eu
cd "$(dirname "$0")/.."
[ -n "${PROD_DATABASE_URL:-}" ] || PROD_DATABASE_URL=$(grep '^PROD_DATABASE_URL=' .env | cut -d= -f2-)
PG_URL=$(echo "$PROD_DATABASE_URL" | sed 's#^postgresql+psycopg://#postgresql://#')

echo "Applying migrations to the hosted database..."
DATABASE_URL="$PROD_DATABASE_URL" uv run alembic upgrade head

echo "Copying documents and chunks..."
docker compose exec -T db psql -U rag -d rag -c \
  "SELECT count(*) AS pending FROM documents WHERE status IN ('queued', 'processing')" -tA \
  | grep -qx 0 || { echo "Ingestion still running locally; wait for it to finish."; exit 1; }
docker compose exec -T db psql "$PG_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE documents CASCADE"
docker compose exec -T db pg_dump -U rag -d rag --data-only --no-owner \
    --table=documents --table=chunks \
  | docker compose exec -T db psql "$PG_URL" -v ON_ERROR_STOP=1 -q
docker compose exec -T db psql "$PG_URL" -c "ANALYZE documents; ANALYZE chunks" -q
docker compose exec -T db psql "$PG_URL" -tAc \
  "SELECT count(*) || ' documents, ' || (SELECT count(*) FROM chunks) || ' chunks' FROM documents"
