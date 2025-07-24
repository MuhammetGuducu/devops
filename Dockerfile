# Stage 1: Build-Umgebung
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm test

# Stage 2: Produktions-Umgebung
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/index.js ./
EXPOSE 8080
CMD ["node", "index.js"]