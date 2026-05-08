FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/document-scanner/package.json apps/document-scanner/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --workspace apps/document-scanner --include-workspace-root

COPY apps/document-scanner apps/document-scanner
RUN npm run build --workspace apps/document-scanner

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends clamav clamav-daemon ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY apps/document-scanner/clamd.conf /etc/clamav/clamd.conf
COPY apps/document-scanner/entrypoint.sh /entrypoint.sh
COPY --from=build /app/apps/document-scanner/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=8080
ENV CLAMD_HOST=127.0.0.1
ENV CLAMD_PORT=3310
ENV CLAMD_TIMEOUT_MS=60000
ENV MAX_SCAN_BYTES=26214400

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
