# Stage 1: Build & Test
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@latest
RUN npm ci
COPY . .
RUN npm test

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install -g npm@latest
RUN npm ci --omit=dev
COPY --from=builder /app .
EXPOSE 8080
CMD ["node", "index.js"]
