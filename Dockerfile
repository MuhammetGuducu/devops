# Stage 1: Build & Test
FROM node:18-alpine AS builder
WORKDIR /app
# package files kopieren
COPY package*.json ./
# Dependencies installieren
RUN npm ci
# Quellcode kopieren
COPY . .
# Tests ausführen
RUN npm test

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
# Nur benötigte Dateien kopieren
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js .
# X-Ray Port für App Runner
EXPOSE 8080
# Non-root user für Sicherheit
USER node
CMD ["node", "index.js"]