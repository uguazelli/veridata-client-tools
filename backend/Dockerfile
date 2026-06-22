FROM python:3.11-slim

WORKDIR /app

# Install uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install dependencies first (better layer caching).
COPY backend/pyproject.toml backend/uv.lock* /app/backend/
WORKDIR /app/backend
RUN uv sync --no-dev --frozen || uv sync --no-dev

# App code + the shared frontend assets it serves.
COPY backend /app/backend
COPY public /app/public
RUN mkdir -p /app/data

ENV PORT=3000
ENV DB_PATH=/app/data/app.db
EXPOSE 3000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
