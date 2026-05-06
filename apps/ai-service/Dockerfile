# syntax=docker/dockerfile:1

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS runtime

ENV APP_PORT=8000
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

COPY apps/ai-service/pyproject.toml apps/ai-service/uv.lock ./
RUN uv sync --frozen --no-dev

COPY apps/ai-service/app ./app

RUN useradd --system --create-home app
USER app

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
