FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH" \
    MODEL_CACHE_DIR=/app/models

# Hugging Face Spaces runs containers as uid 1000.
RUN useradd --create-home --uid 1000 user
WORKDIR /app
RUN chown user:user /app
USER user

COPY --chown=user:user pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Bake the embedding model into the image so cold starts don't download ~400 MB.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-base-en-v1.5', cache_dir='/app/models')"

COPY --chown=user:user . .

EXPOSE 8000
# Apply pending migrations, then serve. Hugging Face Spaces and Render set $PORT.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
