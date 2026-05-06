# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

COPY packages/contracts packages/contracts
COPY packages/ui packages/ui
COPY apps/api apps/api

RUN npm run build --workspace packages/contracts
RUN npm run build --workspace apps/api

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/contracts ./packages/contracts

RUN groupadd --system app && useradd --system --gid app app
USER app

EXPOSE 4000

CMD ["node", "--import", "tsx", "apps/api/dist/main.js"]
