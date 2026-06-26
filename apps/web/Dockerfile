FROM node:20-bookworm-slim AS builder
WORKDIR /repo

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

WORKDIR /repo/apps/web
RUN pnpm build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=builder /repo/apps/web/.next ./.next
COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder /repo/apps/web/package.json ./package.json
COPY --from=builder /repo/apps/web/next.config.js ./next.config.js
COPY --from=builder /repo/apps/web/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "start"]
