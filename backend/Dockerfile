# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm install
RUN node scripts/patch-zk-sdk.cjs node_modules/zk-attendance-sdk/dist/index.js

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist-seed --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --moduleResolution node --strict false

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl tzdata

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY --from=build /app/prisma ./prisma

EXPOSE 5000
CMD ["node", "dist/server.js"]