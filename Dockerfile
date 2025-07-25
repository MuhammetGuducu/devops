# Stage 1: Build & Test
FROM node:18-alpine AS builder

# Build-Zeit Argumente
ARG VERSION=1.0.0
ARG COMMIT_SHA=local

WORKDIR /app

# Package files für besseres Caching
COPY package*.json ./
RUN npm ci

# Quellcode kopieren
COPY . .

# Tests ausführen
RUN npm test

# Umgebungsvariablen als Datei speichern
RUN echo "APP_VERSION=${VERSION}" > .env && \
    echo "COMMIT_SHA=${COMMIT_SHA}" >> .env

# Stage 2: Production
FROM node:18-alpine

# Labels für bessere Container-Verwaltung
LABEL maintainer="Bachelor DevOps"
LABEL version="${VERSION}"
LABEL description="DevOps Demo Service"

WORKDIR /app

# Nur Production Dependencies
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# App-Dateien kopieren
COPY --from=builder /app/index.js .
COPY --from=builder /app/.env .

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

EXPOSE 8080

# Umgebungsvariablen aus .env laden
CMD ["sh", "-c", "source .env && node index.js"]