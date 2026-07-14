FROM node:20-bookworm-slim AS builder
WORKDIR /repo

# Workspace files
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

WORKDIR /repo/apps/api
RUN pnpm prisma generate
RUN pnpm build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/main.js"]
