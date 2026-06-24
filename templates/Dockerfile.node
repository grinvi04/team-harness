# ── 의존성 스테이지 ────────────────────────────────────────────────────
FROM public.ecr.aws/docker/library/node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

# ── 빌드 스테이지 ─────────────────────────────────────────────────────
FROM public.ecr.aws/docker/library/node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 런타임 스테이지 ───────────────────────────────────────────────────
FROM public.ecr.aws/docker/library/node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
