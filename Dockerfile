FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_PUBLIC_CLOUDBASE_ENV_ID=cloudbase-4gonuep215f23af4
ENV NEXT_PUBLIC_CLOUDBASE_REGION=ap-shanghai
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_CLOUDBASE_ENV_ID=cloudbase-4gonuep215f23af4
ENV NEXT_PUBLIC_CLOUDBASE_REGION=ap-shanghai

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next-web/standalone ./
COPY --from=builder /app/.next-web/static ./.next-web/static

EXPOSE 3000

CMD ["node", "server.js"]
