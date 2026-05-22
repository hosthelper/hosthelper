FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @hosthelper/db generate
RUN pnpm --filter @hosthelper/shared build
RUN pnpm --filter @hosthelper/db build
RUN pnpm --filter @hosthelper/api build
RUN pnpm deploy --filter @hosthelper/api --legacy --prod /out

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/packages/db/prisma ./prisma
COPY --from=build /repo/packages/shared/dist ./node_modules/@hosthelper/shared/dist
COPY --from=build /repo/packages/db/dist ./node_modules/@hosthelper/db/dist
EXPOSE 4000
CMD ["node", "dist/main.js"]
