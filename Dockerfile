# --- Stage 1: build the Vue frontend with Bun ---
FROM oven/bun:1.3-alpine AS frontend
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# --- Stage 2: Bun runtime serving API + static frontend ---
FROM oven/bun:1.3-alpine
WORKDIR /app

# Server source + shared modules the server imports from src/
COPY package.json ./
COPY server ./server
COPY src ./src

# Pre-built frontend
COPY --from=frontend /app/dist ./dist

# Skill source the server reads at startup for X-Skill-Latest-Version
COPY .claude ./.claude

ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/dist
ENV STORAGE_DIR=/app/data
EXPOSE 8080

CMD ["bun", "run", "server/main.ts"]
