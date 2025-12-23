# Phase 1 — Build Next.js app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Phase 2 — Production image
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app ./

RUN npm ci --omit=dev --legacy-peer-deps

ENV PORT=3008
EXPOSE 3029

CMD ["npm", "start"]