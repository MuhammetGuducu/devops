# Stage 1: Build & Test
FROM node:18-alpine AS builder

# Build-Argumente definieren
ARG VERSION=1.0.0
ARG COMMIT_SHA=local

WORKDIR /app

# Package files für besseres Layer-Caching
COPY package*.json ./

# Dependencies installieren
RUN npm ci

# Quellcode und Tests kopieren
COPY index.js index.test.js ./

# Tests ausführen
RUN npm test

# Stage 2: Production
FROM node:18-alpine

# Build-Argumente wieder definieren für diese Stage
ARG VERSION=1.0.0
ARG COMMIT_SHA=local

# Labels
LABEL maintainer="Bachelor DevOps"
LABEL version="${VERSION}"
LABEL description="DevOps Demo Service"

WORKDIR /app

# Nur Production Dependencies
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# App-Datei kopieren
COPY index.js .

# Non-root user erstellen
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Verzeichnis-Berechtigungen setzen
RUN chown -R nodejs:nodejs /app

USER nodejs

# Umgebungsvariablen setzen
ENV APP_VERSION=${VERSION}
ENV COMMIT_SHA=${COMMIT_SHA}

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

EXPOSE 8080

CMD ["node", "index.js"]