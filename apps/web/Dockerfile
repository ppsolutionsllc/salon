FROM node:20-alpine AS base

WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json ./
RUN npm install --legacy-peer-deps

# Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Setting env variable normally required for next build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Runner
FROM base AS runner
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Note: for full deployment, the build step above must succeed. 
# For development via docker-compose, we mount volumes and run `npm run dev` directly via command override

CMD ["node", "server.js"]
