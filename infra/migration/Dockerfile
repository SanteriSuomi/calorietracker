FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps
COPY drizzle/ ./drizzle/
COPY drizzle-pg.config.ts ./
COPY src/lib/server/db/ ./src/lib/server/db/
CMD ["npx", "drizzle-kit", "migrate", "--config=drizzle-pg.config.ts"]
