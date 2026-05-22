FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @hosthelper/db generate
RUN pnpm --filter @hosthelper/shared build
RUN pnpm --filter @hosthelper/db build
RUN pnpm --filter @hosthelper/worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/worker/dist ./dist
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./node_modules/@hosthelper/shared/dist
COPY --from=build /repo/packages/db/dist ./node_modules/@hosthelper/db/dist
CMD ["node", "dist/main.js"]
